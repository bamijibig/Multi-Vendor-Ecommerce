"""URL map for the decoupled REST API (mounted at /api/)."""

from django.urls import include, path
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views.admin_center import (
    AdminFinanceRulesView,
    AdminOverviewView,
    AdminPayoutListView,
    AdminPayoutProcessView,
    AdminProductListView,
    AdminProductModerateView,
    AdminReturnResolveView,
    AdminVendorListView,
    AdminVendorStatusView,
)
from .views import (
    AdminDashboardView,
    AdminOrderViewSet,
    AddressViewSet,
    CartViewSet,
    CategoryViewSet,
    CompletedOrderViewSet,
    ConfirmPaymentView,
    CreatePaymentIntentView,
    CustomerOrderViewSet,
    HomeView,
    IndustryViewSet,
    LoginView,
    MeView,
    ProductReviewViewSet,
    ProductViewSet,
    RegisterView,
    SubCategoryViewSet,
    VendorDashboardView,
    VendorOrderItemViewSet,
    VendorRegisterView,
    VendorStoreViewSet,
)

router = DefaultRouter()
router.register("products", ProductViewSet, basename="products")
router.register("reviews", ProductReviewViewSet, basename="reviews")
router.register("industries", IndustryViewSet, basename="industries")
router.register("categories", CategoryViewSet, basename="categories")
router.register("subcategories", SubCategoryViewSet, basename="subcategories")
router.register("vendors", VendorStoreViewSet, basename="vendors")
router.register("cart", CartViewSet, basename="cart")
router.register("addresses", AddressViewSet, basename="addresses")
router.register("orders", CustomerOrderViewSet, basename="orders")
router.register("completed-orders", CompletedOrderViewSet, basename="completed-orders")
router.register("vendor/order-items", VendorOrderItemViewSet, basename="vendor-order-items")
router.register("admin/orders", AdminOrderViewSet, basename="admin-orders")


@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"success": True, "status": "ok"})


urlpatterns = [
    # Authentication
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/vendor/register/", VendorRegisterView.as_view(), name="vendor-register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    # Storefront aggregates and dashboards
    path("home/", HomeView.as_view(), name="home"),
    # AI assistant (buyer concierge + seller draft workflow)
    path("ai/", include("ai_assistant.urls")),
    # Finance (commissions, VAT, ledger, payouts)
    path("finance/", include("finance.urls")),
    # Analytics (seller dashboard and events)
    path("analytics/", include("analytics.urls")),
    path("dashboard/admin/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("dashboard/vendor/", VendorDashboardView.as_view(), name="vendor-dashboard"),
    # General admin center
    path(
        "admin/dashboard/overview/",
        AdminOverviewView.as_view(),
        name="admin-overview",
    ),
    path("admin/vendors/", AdminVendorListView.as_view(), name="admin-vendors"),
    path(
        "admin/vendors/<int:vendor_id>/status/",
        AdminVendorStatusView.as_view(),
        name="admin-vendor-status",
    ),
    path(
        "admin/orders/<int:order_item_id>/resolve-return/",
        AdminReturnResolveView.as_view(),
        name="admin-resolve-return",
    ),
    path(
        "admin/finance/rules/",
        AdminFinanceRulesView.as_view(),
        name="admin-finance-rules",
    ),
    path("admin/payouts/", AdminPayoutListView.as_view(), name="admin-payouts"),
    path(
        "admin/payouts/<int:payout_id>/process/",
        AdminPayoutProcessView.as_view(),
        name="admin-payout-process",
    ),
    path("admin/products/", AdminProductListView.as_view(), name="admin-products"),
    path(
        "admin/products/<int:product_id>/moderate/",
        AdminProductModerateView.as_view(),
        name="admin-product-moderate",
    ),
    # Payments
    path("payments/create-intent/", CreatePaymentIntentView.as_view(), name="create-intent"),
    path("payments/confirm/", ConfirmPaymentView.as_view(), name="confirm-payment"),
    # Utilities
    path("health/", health_check, name="health"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("", include(router.urls)),
]
