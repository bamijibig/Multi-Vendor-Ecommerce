from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import CustomUser
from products.models import Cart, CompletedOder, PlacedOder, PlacedeOderItem, Product
from Vendors.models import VendorStore

from ..permissions import IsAdminUser, IsVendor
from ..serializers import PlacedOrderSerializer, VendorOrderItemSerializer


class AdminDashboardView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        last_30 = timezone.now() - timedelta(days=30)
        recent = (
            PlacedOder.objects.select_related("shipping_address", "user")
            .prefetch_related("order_items__product")
            .order_by("-placed_date")[:8]
        )
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
                    "total_products": Product.objects.count(),
                    "total_vendors": VendorStore.objects.count(),
                    "total_customers": CustomUser.objects.filter(user_role="1").count(),
                    "gross_revenue": CompletedOder.objects.aggregate(
                        total=Sum("sub_total_price")
                    )["total"]
                    or 0,
                },
                "recent_orders": PlacedOrderSerializer(
                    recent, many=True, context={"request": request}
                ).data,
            }
        )


class VendorDashboardView(APIView):
    permission_classes = [IsVendor]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        products = Product.objects.filter(vendor_stores__user=request.user)
        product_ids = products.values_list("id", flat=True)
        items = PlacedeOderItem.objects.filter(product_id__in=product_ids)
        recent_items = (
            items.select_related(
                "product__vendor_stores",
                "product__categories",
                "placed_oder__user",
                "placed_oder__shipping_address",
            )
            .order_by("-placed_oder__placed_date")[:10]
        )
        return Response(
            {
                "success": True,
                "stats": {
                    "total_products": products.count(),
                    "low_stock_products": products.filter(stoc__lte=5).count(),
                    "order_items": items.count(),
                    "unique_orders": items.values("placed_oder_id").distinct().count(),
                    "gross_sales": items.aggregate(total=Sum("total_price"))["total"] or 0,
                },
                "low_stock": [
                    {"id": p.id, "title": p.title, "slug": p.slug, "stoc": p.stoc}
                    for p in products.filter(stoc__lte=5)[:10]
                ],
                "recent_order_items": VendorOrderItemSerializer(
                    recent_items, many=True, context={"request": request}
                ).data,
            }
        )
