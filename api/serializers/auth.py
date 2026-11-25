from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from Vendors.models import VendorStore

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Public representation of the authenticated user."""

    full_name = serializers.SerializerMethodField()
    is_vendor = serializers.SerializerMethodField()
    is_customer = serializers.SerializerMethodField()
    stores = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "mobile",
            "user_role",
            "date_joined",
            "is_active",
            "is_superuser",
            "is_vendor",
            "is_customer",
            "stores",
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_is_vendor(self, obj):
        return obj.user_role == "3"

    def get_is_customer(self, obj):
        return obj.user_role == "1"

    def get_stores(self, obj):
        return list(obj.vendorstore_set.values("id", "name", "slug"))


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "mobile"]


class BaseRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=30)
    last_name = serializers.CharField(max_length=30)
    mobile = serializers.IntegerField(min_value=1)
    password = serializers.CharField(write_only=True, validators=[validate_password])

    role = "1"

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            mobile=validated_data["mobile"],
            user_role=self.role,
        )


class RegisterSerializer(BaseRegisterSerializer):
    """Customer self-registration (role '1')."""

    role = "1"


class VendorRegisterSerializer(BaseRegisterSerializer):
    """Vendor self-registration (role '3').

    ``store_name`` is optional to preserve the legacy flow where an admin
    creates the store afterwards, but supplying it creates the store
    immediately so the new vendor can start adding products.
    """

    role = "3"
    store_name = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_store_name(self, value):
        if value and VendorStore.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("A store with this name already exists.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        store_name = validated_data.pop("store_name", "").strip()
        user = super().create(validated_data)
        if store_name:
            VendorStore.objects.create(
                user=user,
                name=store_name,
                status=VendorStore.STATUS_PENDING,
                status_note="Awaiting admin onboarding approval.",
            )
        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT login that also returns the user profile in the response."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.user_role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
