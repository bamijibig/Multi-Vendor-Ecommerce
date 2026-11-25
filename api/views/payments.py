import os

import stripe
from django.conf import settings
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.models import Cart, CustomerAddress, PlacedOder

from ..serializers import ConfirmPaymentSerializer, PlacedOrderSerializer
from ..services import place_order


def _stripe_key():
    return getattr(settings, "STRIPE_SECRET_KEY", "") or os.getenv(
        "STRIPE_SECRET_KEY", ""
    )


class CreatePaymentIntentView(APIView):
    """Create a Stripe PaymentIntent for the server-calculated cart total."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        cart = Cart.objects.filter(user=request.user)
        if not cart.exists():
            return Response(
                {"success": False, "error": {"message": "Your cart is empty."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subtotal = Cart.subtotal_product_price(request.user)
        amount = int(round(subtotal * 100))
        if amount <= 0:
            return Response(
                {"success": False, "error": {"message": "Invalid order amount."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        key = _stripe_key()
        if not key:
            return Response(
                {
                    "success": False,
                    "error": {
                        "message": "Stripe is not configured. Set STRIPE_SECRET_KEY."
                    },
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            stripe.api_key = key
            intent = stripe.PaymentIntent.create(
                amount=amount,
                currency="usd",
                automatic_payment_methods={"enabled": True},
                metadata={
                    "user_id": str(request.user.id),
                    "cart_count": str(cart.count()),
                },
            )
        except Exception as exc:  # noqa: BLE001 - surface Stripe errors as JSON
            return Response(
                {"success": False, "error": {"message": str(exc)}},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "success": True,
                "clientSecret": intent.client_secret,
                "amount": amount / 100,
                "currency": "usd",
            }
        )


class ConfirmPaymentView(APIView):
    """Verify a succeeded PaymentIntent and atomically place the order.

    Idempotent: repeating the request for an already-confirmed intent returns
    the existing order instead of creating a duplicate.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=ConfirmPaymentSerializer,
        responses=OpenApiTypes.OBJECT,
    )
    def post(self, request):
        payload = ConfirmPaymentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        address = CustomerAddress.objects.filter(
            pk=payload.validated_data["shipping_address_id"], user=request.user
        ).first()
        if not address:
            return Response(
                {"success": False, "error": {"message": "Shipping address not found."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        key = _stripe_key()
        if not key:
            return Response(
                {
                    "success": False,
                    "error": {"message": "Stripe is not configured."},
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            stripe.api_key = key
            intent = stripe.PaymentIntent.retrieve(
                payload.validated_data["payment_intent_id"]
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"success": False, "error": {"message": str(exc)}},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        metadata = intent.get("metadata") or {}
        if str(metadata.get("user_id")) != str(request.user.id):
            return Response(
                {"success": False, "error": {"message": "Payment does not belong to you."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        existing_order_id = metadata.get("placed_order_id")
        if existing_order_id:
            existing = PlacedOder.objects.filter(
                pk=existing_order_id, user=request.user
            ).first()
            if existing:
                return Response(
                    {
                        "success": True,
                        "order": PlacedOrderSerializer(
                            existing, context={"request": request}
                        ).data,
                    }
                )

        if intent.get("status") != "succeeded":
            return Response(
                {
                    "success": False,
                    "error": {"message": "Payment has not succeeded yet."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        expected = int(round(Cart.subtotal_product_price(request.user) * 100))
        if (intent.get("amount_received") or 0) < expected:
            return Response(
                {
                    "success": False,
                    "error": {"message": "Paid amount does not cover the order total."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = place_order(request.user, address, paid=True)
        try:
            stripe.PaymentIntent.modify(
                intent.id,
                metadata={
                    **metadata,
                    "placed_order_id": str(order.id),
                    "order_number": order.order_number or "",
                },
            )
        except Exception:  # noqa: BLE001 - order is already placed; metadata is best-effort
            pass

        return Response(
            {
                "success": True,
                "order": PlacedOrderSerializer(order, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )
