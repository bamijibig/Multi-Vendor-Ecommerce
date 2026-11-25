from django.db.models import Count, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from Vendors.models import VendorStore

from ..permissions import IsStoreOwnerOrAdmin, IsVendor, is_admin
from ..serializers import VendorStoreSerializer


class VendorStoreViewSet(viewsets.ModelViewSet):
    """Public storefronts; only the owning vendor can edit a store."""

    queryset = (
        VendorStore.objects.select_related("user")
        .prefetch_related("product_set")
        .annotate(
            visible_product_count=Count(
                "product",
                filter=Q(
                    product__moderation_status="APPROVED"
                ),
                distinct=True,
            )
        )
        .order_by("-is_official", "name")
    )
    serializer_class = VendorStoreSerializer
    lookup_field = "slug"
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "mine" or is_admin(self.request.user):
            return queryset
        return queryset.filter(status=VendorStore.STATUS_ACTIVE)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == "retrieve":
            context["include_storefront"] = True
        return context

    def get_permissions(self):
        if self.action == "create":
            return [IsVendor()]
        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsStoreOwnerOrAdmin()]
        if self.action == "mine":
            return [IsVendor()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user,
            status=VendorStore.STATUS_PENDING,
            status_note="Awaiting admin onboarding approval.",
        )

    @action(detail=False, methods=["get"])
    def mine(self, request):
        stores = self.get_queryset().filter(user=request.user)
        serializer = self.get_serializer(stores, many=True)
        return Response({"success": True, "results": serializer.data})
