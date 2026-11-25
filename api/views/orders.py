from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from products.models import (
    Cart,
    CompletedOder,
    CompletedOderItems,
    CustomerAddress,
    PlacedOder,
    PlacedeOderItem,
)

from ..pagination import StandardResultsSetPagination
from ..permissions import IsAdminUser, IsVendor, is_admin
from ..serializers import (
    AdminOrderUpdateSerializer,
    CompletedOrderSerializer,
    PlaceOrderSerializer,
    PlacedOrderSerializer,
    VendorOrderItemSerializer,
)
from ..serializers.admin_center import AdminReturnItemSerializer
from ..services import complete_order, place_order


class CustomerOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Customers can read their own orders and place a new one."""

    serializer_class = PlacedOrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return (
            PlacedOder.objects.filter(user=self.request.user)
            .select_related("shipping_address", "user")
            .prefetch_related("order_items__product__vendor_stores")
            .order_by("-placed_date")
        )

    @action(detail=False, methods=["post"])
    def place(self, request):
        payload = PlaceOrderSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        address = CustomerAddress.objects.filter(
            pk=payload.validated_data["shipping_address_id"], user=request.user
        ).first()
        if not address:
            return Response(
                {"success": False, "error": {"message": "Shipping address not found."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order = place_order(request.user, address, paid=False)
        return Response(
            {
                "success": True,
                "order": PlacedOrderSerializer(
                    order, context=self.get_serializer_context()
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CompletedOrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CompletedOrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = CompletedOder.objects.select_related(
            "shipping_address", "user"
        ).prefetch_related("delivered_items__product")
        if is_admin(self.request.user):
            return queryset.order_by("-complete_date")
        return queryset.filter(user=self.request.user).order_by("-complete_date")


class VendorOrderItemViewSet(viewsets.ReadOnlyModelViewSet):
    """Vendors only see order items for products in their own store(s)."""

    serializer_class = VendorOrderItemSerializer
    permission_classes = [IsVendor]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["placed_oder__order_number", "product__title", "placed_oder__user__email"]
    ordering_fields = ["placed_oder__placed_date", "total_price"]
    ordering = ["-placed_oder__placed_date"]

    def get_queryset(self):
        queryset = PlacedeOderItem.objects.filter(
            product__vendor_stores__user=self.request.user
        ).select_related(
            "product__vendor_stores",
            "product__categories",
            "placed_oder__user",
            "placed_oder__shipping_address",
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(placed_oder__status=status_filter)
        return queryset.distinct()


class AdminOrderViewSet(viewsets.ModelViewSet):
    """Full order oversight for admins/employees."""

    queryset = (
        PlacedOder.objects.select_related("shipping_address", "user")
        .prefetch_related("order_items__product__vendor_stores")
        .order_by("-placed_date")
    )
    serializer_class = PlacedOrderSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "paid"]
    search_fields = ["order_number", "user__email", "user__first_name"]
    ordering_fields = ["placed_date", "sub_total_price"]
    ordering = ["-placed_date"]

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        returns = CompletedOderItems.objects.select_related(
            "completed_oder__user", "product__vendor_stores__user"
        ).exclude(return_status=CompletedOderItems.RETURN_NONE)
        return_status = request.query_params.get("return_status")
        if return_status:
            returns = returns.filter(return_status=return_status.upper())
        search = request.query_params.get("search")
        if search:
            returns = returns.filter(
                Q(completed_oder__oder_number__icontains=search)
                | Q(completed_oder__user__email__icontains=search)
                | Q(product__title__icontains=search)
                | Q(product__vendor_stores__name__icontains=search)
            )
        response.data["returns"] = AdminReturnItemSerializer(
            returns.order_by("-return_requested_at")[:100], many=True
        ).data
        response.data["return_counts"] = {
            "requested": CompletedOderItems.objects.filter(
                return_status=CompletedOderItems.RETURN_REQUESTED
            ).count(),
            "approved": CompletedOderItems.objects.filter(
                return_status=CompletedOderItems.RETURN_APPROVED
            ).count(),
            "rejected": CompletedOderItems.objects.filter(
                return_status=CompletedOderItems.RETURN_REJECTED
            ).count(),
        }
        return response

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = AdminOrderUpdateSerializer(
            instance, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "success": True,
                "order": PlacedOrderSerializer(
                    instance, context=self.get_serializer_context()
                ).data,
            }
        )

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        order = self.get_object()
        completed = complete_order(order)
        return Response(
            {
                "success": True,
                "completed_order": CompletedOrderSerializer(
                    completed, context=self.get_serializer_context()
                ).data,
            }
        )

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        from datetime import timedelta

        from django.utils import timezone

        last_30 = timezone.now() - timedelta(days=30)
        return Response(
            {
                "success": True,
                "stats": {
                    "total_placed_orders": PlacedOder.objects.count(),
                    "total_completed_orders": CompletedOder.objects.count(),
                    "completed_last_30_days": CompletedOder.objects.filter(
                        complete_date__gte=last_30
                    ).count(),
                    "customers_with_cart": Cart.objects.values("user_id").distinct().count(),
                },
            }
        )
