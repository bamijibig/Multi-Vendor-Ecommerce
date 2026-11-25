from __future__ import annotations

from datetime import datetime

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from api.permissions import IsVendor
from products.models import Product

from .models import ProductViewEvent
from .services import parse_range, track_product_view, vendor_dashboard


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


class ProductViewEventView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=dict, responses=dict)
    def post(self, request):
        product_id = request.data.get("product_id")
        product = Product.objects.filter(pk=product_id).first()
        if product is None:
            return Response(
                {"success": False, "error": {"message": "Product not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        event = track_product_view(
            product, user=request.user if request.user.is_authenticated else None,
            session_key=request.data.get("session_key", ""),
        )
        return Response({"success": True, "event_id": event.id}, status=status.HTTP_201_CREATED)


class VendorAnalyticsDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(responses=dict)
    def get(self, request):
        range_value = request.query_params.get("range", "30d")
        start = parse_date(request.query_params.get("start"))
        end = parse_date(request.query_params.get("end"))
        start_date, end_date, previous_start, previous_end = parse_range(range_value, start, end)
        data = vendor_dashboard(request.user, start_date, end_date, previous_start, previous_end)
        return Response({"success": True, **data})