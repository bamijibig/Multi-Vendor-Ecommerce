"""
URL configuration for ecommerce project.

The React app owns every dashboard. The old Django admin sites are not mounted;
their URLs redirect to the React Admin Center or vendor dashboard instead.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect
from django.urls import include, path, re_path


def frontend_admin_redirect(request):
    return redirect(f"{settings.FRONTEND_URL.rstrip('/')}/admin-center")


def frontend_vendor_redirect(request):
    return redirect(f"{settings.FRONTEND_URL.rstrip('/')}/vendor/dashboard")


urlpatterns = [
    path('api/', include('api.urls')),
    re_path(r'^super-admin(?:/.*)?$', frontend_admin_redirect, name='super_admin_dashboard'),
    re_path(r'^employee-dashboard(?:/.*)?$', frontend_admin_redirect, name='employee_dashboard'),
    re_path(r'^vendor-dashboard(?:/.*)?$', frontend_vendor_redirect, name='vendor_dashboard'),
    path('', include("accounts.urls")),
    path('', include('products.urls')),
    path('', include('home.urls')),
    path('', include('AdminPanel.urls')),
    path('', include('Vendors.urls')),
    path('', include('payments.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
