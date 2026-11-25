from __future__ import annotations

from datetime import datetime

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from api.permissions import IsAdminOrEmployee, IsVendor
from products.models import CompletedOder

from .models import CategoryCommissionRule, TaxConfiguration, VendorLedgerEntry
from .serializers import (
    CategoryCommissionRuleSerializer,
    TaxConfigurationSerializer,
    VendorLedgerEntrySerializer,
)
from .services import (
    finance_summary,
    get_active_tax_config,
    reverse_completed_order,
    statement_csv,
    vendor_balances,
    vendor_statement,
)


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


class VendorStatementView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(responses=dict)
    def get(self, request):
        start = parse_date(request.query_params.get("start"))
        end = parse_date(request.query_params.get("end"))
        payout_status = request.query_params.get("payout_status") or None
        entries = vendor_statement(request.user, start, end, payout_status)
        serializer = VendorLedgerEntrySerializer(entries, many=True)
        return Response(
            {
                "success": True,
                "filters": {
                    "start": str(start) if start else None,
                    "end": str(end) if end else None,
                    "payout_status": payout_status,
                },
                "balances": vendor_balances(request.user, start, end),
                "rows": serializer.data,
            }
        )


class VendorStatementExportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(responses=dict)
    def get(self, request):
        start = parse_date(request.query_params.get("start"))
        end = parse_date(request.query_params.get("end"))
        payout_status = request.query_params.get("payout_status") or None
        entries = vendor_statement(request.user, start, end, payout_status)
        content = statement_csv(entries)
        response = HttpResponse(content, content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="vendor-statement.csv"'
        return response


class CategoryCommissionRuleViewSet(viewsets.ModelViewSet):
    queryset = CategoryCommissionRule.objects.select_related("category").all()
    serializer_class = CategoryCommissionRuleSerializer
    permission_classes = [IsAdminOrEmployee]


class TaxConfigurationView(APIView):
    permission_classes = [IsAdminOrEmployee]

    @extend_schema(responses=TaxConfigurationSerializer)
    def get(self, request):
        serializer = TaxConfigurationSerializer(get_active_tax_config())
        return Response({"success": True, "config": serializer.data})

    @extend_schema(request=TaxConfigurationSerializer, responses=TaxConfigurationSerializer)
    def patch(self, request):
        config = get_active_tax_config()
        serializer = TaxConfigurationSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"success": True, "config": serializer.data})


class FinanceSummaryView(APIView):
    permission_classes = [IsAdminOrEmployee]

    @extend_schema(responses=dict)
    def get(self, request):
        start = parse_date(request.query_params.get("start"))
        end = parse_date(request.query_params.get("end"))
        return Response({"success": True, "summary": finance_summary(start, end)})


class ReverseOrderLedgerView(APIView):
    permission_classes = [IsAdminOrEmployee]

    @extend_schema(request=dict, responses=dict)
    def post(self, request, completed_order_id):
        completed = CompletedOder.objects.filter(pk=completed_order_id).first()
        if completed is None:
            return Response(
                {"success": False, "error": {"message": "Completed order not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        reason = request.data.get("reason", "")
        reversals = reverse_completed_order(completed, reason)
        return Response(
            {
                "success": True,
                "reversed_count": len(reversals),
                "entries": VendorLedgerEntrySerializer(reversals, many=True).data,
            }
        )