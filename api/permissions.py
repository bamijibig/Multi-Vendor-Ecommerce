"""Role and object-level permissions for the multivendor API.

The project keeps its existing role model on ``accounts.CustomUser``:
    '1' Customer, '2' Editor/Employee, '3' Vendor.
Superusers always pass every check.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_admin(user):
    """Admins are superusers, or employees/editors (role '2')."""
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.user_role == "2")
    )


def is_vendor(user):
    return bool(user and user.is_authenticated and user.user_role == "3")


def is_customer(user):
    return bool(user and user.is_authenticated and user.user_role == "1")


class IsAdminUser(BasePermission):
    """Project admin guard for platform administration endpoints.

    This intentionally mirrors the role model instead of DRF's built-in
    ``IsAdminUser``. The legacy user model defaults ``is_staff`` to ``True`` for
    every account, so the built-in permission would expose admin endpoints to
    customers and vendors. Admins are superusers or employees (role ``'2'``).
    """

    message = "Only administrators or employees can perform this action."

    def has_permission(self, request, view):
        return is_admin(request.user)


# Kept for existing call sites; the role-aware guard above is the canonical name.
IsAdminOrEmployee = IsAdminUser


class IsVendor(BasePermission):
    message = "Only vendor accounts can perform this action."

    def has_permission(self, request, view):
        return is_vendor(request.user)


class IsCustomer(BasePermission):
    message = "Only customer accounts can perform this action."

    def has_permission(self, request, view):
        return is_customer(request.user)


class IsOwnerOrAdmin(BasePermission):
    """Object permission: the object belongs to ``request.user`` or the user is admin."""

    owner_field = "user"

    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            return True
        return getattr(obj, self.owner_field, None) == request.user


class IsVendorOwnerOrAdmin(BasePermission):
    """Object permission for products owned by the vendor's store.

    Read access is public; writes require an admin or the vendor that owns the
    product's store.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if is_admin(request.user):
            return True
        store = getattr(obj, "vendor_stores", None)
        return bool(
            is_vendor(request.user)
            and store is not None
            and store.user_id == request.user.id
        )


class CanManageProducts(BasePermission):
    """Public reads; vendors/admins may write, vendors only their own store."""

    message = "You do not have permission to manage this product."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return is_admin(request.user) or is_vendor(request.user)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if is_admin(request.user):
            return True
        store = getattr(obj, "vendor_stores", None)
        return bool(
            is_vendor(request.user) and store and store.user_id == request.user.id
        )


class IsStoreOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if is_admin(request.user):
            return True
        return is_vendor(request.user) and obj.user_id == request.user.id
