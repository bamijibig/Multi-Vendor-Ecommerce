from django.contrib.auth.models import Group
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from ..serializers import (
    EmailTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
    UserUpdateSerializer,
    VendorRegisterSerializer,
)


def _auth_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "user": UserSerializer(user).data,
    }


class RegisterView(generics.CreateAPIView):
    """Customer registration. Returns JWT tokens so the client can log in immediately."""

    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer
    queryset = None

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"success": True, **_auth_payload(user)}, status=status.HTTP_201_CREATED
        )


class VendorRegisterView(generics.CreateAPIView):
    """Vendor registration (role '3') with an optional store name."""

    permission_classes = [permissions.AllowAny]
    serializer_class = VendorRegisterSerializer
    queryset = None

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        vendor_group, _ = Group.objects.get_or_create(name="Vendors")
        user.groups.add(vendor_group)

        return Response(
            {"success": True, **_auth_payload(user)}, status=status.HTTP_201_CREATED
        )


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH the authenticated user's profile."""

    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"success": True, "user": UserSerializer(instance).data})
