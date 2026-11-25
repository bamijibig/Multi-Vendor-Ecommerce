from django.urls import path

from .views import ProductViewEventView, VendorAnalyticsDashboardView

urlpatterns = [
    path("events/product-view/", ProductViewEventView.as_view(), name="product-view-event"),
    path("vendor/dashboard/", VendorAnalyticsDashboardView.as_view(), name="vendor-analytics-dashboard"),
]