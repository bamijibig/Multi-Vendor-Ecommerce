from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryCommissionRuleViewSet,
    FinanceSummaryView,
    ReverseOrderLedgerView,
    TaxConfigurationView,
    VendorStatementExportView,
    VendorStatementView,
)

router = DefaultRouter()
router.register("admin/commission-rules", CategoryCommissionRuleViewSet, basename="commission-rules")

urlpatterns = [
    path("vendor/statement/", VendorStatementView.as_view(), name="vendor-statement"),
    path("vendor/statement/export/", VendorStatementExportView.as_view(), name="vendor-statement-export"),
    path("admin/tax-config/", TaxConfigurationView.as_view(), name="tax-config"),
    path("admin/summary/", FinanceSummaryView.as_view(), name="finance-summary"),
    path("admin/reverse-order/<int:completed_order_id>/", ReverseOrderLedgerView.as_view(), name="reverse-order-ledger"),
    path("", include(router.urls)),
]