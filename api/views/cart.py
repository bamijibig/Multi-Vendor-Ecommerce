from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from products.models import Cart, CuponCodeGenaration, CustomerAddress

from ..serializers import (
    AddressSerializer,
    CartItemSerializer,
    CartItemWriteSerializer,
    CouponSerializer,
)


class CartViewSet(viewsets.ModelViewSet):
    """The authenticated customer's cart.

    ``GET /cart/`` returns a summary (items + totals + active coupon) instead
    of a paginated list, so the client can render the mini-cart and cart page
    from a single request.
    """

    serializer_class = CartItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return (
            Cart.objects.filter(user=self.request.user)
            .select_related(
                "product__categories__industry",
                "product__vendor_stores",
                "shipping_address",
                "cupon_code",
            )
            .prefetch_related("product__productimage_set")
            .order_by("id")
        )

    def _summary(self):
        queryset = self.get_queryset()
        serializer = CartItemSerializer(
            queryset, many=True, context=self.get_serializer_context()
        )
        subtotal = (
            Cart.subtotal_product_price(self.request.user) if queryset.exists() else 0
        )
        first = queryset.first()
        coupon = (
            CouponSerializer(first.cupon_code).data
            if first and first.cupon_code
            else None
        )
        return {
            "success": True,
            "count": queryset.count(),
            "total_quantity": sum(item.quantity for item in queryset),
            "subtotal": round(subtotal, 2),
            "coupon_applied": bool(first and first.cupon_applaied),
            "coupon": coupon,
            "items": serializer.data,
        }

    def list(self, request, *args, **kwargs):
        return Response(self._summary())

    def create(self, request, *args, **kwargs):
        payload = CartItemWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        product = payload.validated_data["product"]
        quantity = payload.validated_data["quantity"]

        item, created = Cart.objects.get_or_create(
            user=request.user, product=product, defaults={"quantity": quantity}
        )
        if not created:
            new_quantity = item.quantity + quantity
            if new_quantity > product.stoc:
                return Response(
                    {
                        "success": False,
                        "error": {
                            "message": f"Only {product.stoc} unit(s) available."
                        },
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            item.quantity = min(new_quantity, 50)
            item.save(update_fields=["quantity"])

        return Response(self._summary(), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        item = self.get_object()
        try:
            quantity = int(request.data.get("quantity", item.quantity))
        except (TypeError, ValueError):
            return Response(
                {"success": False, "error": {"message": "Quantity must be a number."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if quantity < 1:
            return Response(
                {"success": False, "error": {"message": "Quantity must be at least 1."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if quantity > min(50, item.product.stoc):
            return Response(
                {
                    "success": False,
                    "error": {"message": f"Only {item.product.stoc} unit(s) available."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        item.quantity = quantity
        item.save(update_fields=["quantity"])
        return Response(self._summary())

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return Response(self._summary(), status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="apply-coupon")
    def apply_coupon(self, request):
        code = (request.data.get("code") or "").strip()
        coupon = CuponCodeGenaration.objects.filter(cupon_code__iexact=code).first()
        if not coupon:
            return Response(
                {"success": False, "error": {"message": "Invalid coupon code."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not self.get_queryset().exists():
            return Response(
                {"success": False, "error": {"message": "Your cart is empty."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self.get_queryset().update(cupon_code=coupon, cupon_applaied=True)
        return Response(self._summary())

    @action(detail=False, methods=["post"], url_path="remove-coupon")
    def remove_coupon(self, request):
        self.get_queryset().update(cupon_code=None, cupon_applaied=False)
        return Response(self._summary())

    @action(detail=False, methods=["post"], url_path="set-address")
    def set_address(self, request):
        address_id = request.data.get("address_id")
        address = CustomerAddress.objects.filter(
            pk=address_id, user=request.user
        ).first()
        if not address:
            return Response(
                {"success": False, "error": {"message": "Address not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        self.get_queryset().update(shipping_address=address)
        summary = self._summary()
        summary["shipping_address"] = AddressSerializer(address).data
        return Response(summary)


class AddressViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return CustomerAddress.objects.filter(user=self.request.user).order_by("-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        # Newest address becomes the checkout default automatically.
        Cart.objects.filter(user=self.request.user).update(
            shipping_address=serializer.instance
        )
