from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from finance.models import VendorPayout
from finance.services import vendor_balances
from products.models import CompletedOderItems, Product
from Vendors.models import VendorStore


class AdminVendorSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    owner_name = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()
    seller_score = serializers.SerializerMethodField()
    balances = serializers.SerializerMethodField()
    completed_orders = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = VendorStore
        fields = [
            "id",
            "user_id",
            "user_email",
            "owner_name",
            "name",
            "slug",
            "status",
            "status_display",
            "status_note",
            "status_updated_at",
            "created_at",
            "product_count",
            "seller_score",
            "balances",
            "completed_orders",
        ]

    def get_owner_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()

    def get_product_count(self, obj):
        return obj.product_set.count()

    def get_seller_score(self, obj):
        from analytics.services import calculate_seller_score

        today = timezone.now().date()
        return calculate_seller_score(
            obj.user, today - timedelta(days=89), today
        )["score"]

    def get_balances(self, obj):
        balances = vendor_balances(obj.user)
        return {key: str(value) for key, value in balances.items()}

    def get_completed_orders(self, obj):
        return CompletedOderItems.objects.filter(
            product__vendor_stores=obj
        ).values("completed_oder_id").distinct().count()


class AdminProductSerializer(serializers.ModelSerializer):
    vendor_store = serializers.SerializerMethodField()
    vendor_email = serializers.CharField(
        source="vendor_stores.user.email", read_only=True, default=None
    )
    category_name = serializers.CharField(
        source="categories.name", read_only=True, default=None
    )
    moderation_status_display = serializers.CharField(
        source="get_moderation_status_display", read_only=True
    )
    ai_generated = serializers.SerializerMethodField()
    bulk_uploaded = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "title",
            "slug",
            "regular_price",
            "stoc",
            "out_of_stoc",
            "categories",
            "category_name",
            "vendor_stores",
            "vendor_store",
            "vendor_email",
            "moderation_status",
            "moderation_status_display",
            "moderation_note",
            "moderated_at",
            "created_at",
            "ai_generated",
            "bulk_uploaded",
        ]

    def get_vendor_store(self, obj):
        store = obj.vendor_stores
        if store is None:
            return None
        return {"id": store.id, "name": store.name, "slug": store.slug}

    def _drafts(self, obj):
        drafts = getattr(obj, "prefetched_drafts", None)
        if drafts is None:
            drafts = list(obj.ai_draft_source.all())
        return drafts

    def get_ai_generated(self, obj):
        return bool(self._drafts(obj))

    def get_bulk_uploaded(self, obj):
        return any(draft.bulk_batch_id for draft in self._drafts(obj))


class AdminReturnItemSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source="completed_oder.id", read_only=True)
    order_number = serializers.CharField(
        source="completed_oder.oder_number", read_only=True
    )
    customer_email = serializers.CharField(
        source="completed_oder.user.email", read_only=True
    )
    customer_name = serializers.SerializerMethodField()
    completed_date = serializers.DateTimeField(
        source="completed_oder.complete_date", read_only=True
    )
    order_status = serializers.CharField(
        source="completed_oder.status", read_only=True
    )
    product_title = serializers.CharField(source="product.title", read_only=True)
    vendor_store = serializers.SerializerMethodField()
    vendor_email = serializers.CharField(
        source="product.vendor_stores.user.email", read_only=True, default=None
    )
    return_status_display = serializers.CharField(
        source="get_return_status_display", read_only=True
    )
    refund_status_display = serializers.CharField(
        source="get_refund_status_display", read_only=True
    )

    class Meta:
        model = CompletedOderItems
        fields = [
            "id",
            "order_id",
            "order_number",
            "customer_email",
            "customer_name",
            "completed_date",
            "order_status",
            "product",
            "product_title",
            "vendor_store",
            "vendor_email",
            "quantity",
            "total_price",
            "return_status",
            "return_status_display",
            "refund_status",
            "refund_status_display",
            "return_reason",
            "return_requested_at",
            "return_resolved_at",
            "return_resolution_note",
        ]

    def get_customer_name(self, obj):
        user = obj.completed_oder.user
        return f"{user.first_name} {user.last_name}".strip()

    def get_vendor_store(self, obj):
        store = getattr(obj.product, "vendor_stores", None)
        if store is None:
            return None
        return {"id": store.id, "name": store.name, "slug": store.slug}


class AdminPayoutSerializer(serializers.ModelSerializer):
    vendor_email = serializers.CharField(source="vendor.email", read_only=True)
    vendor_name = serializers.SerializerMethodField()
    store_name = serializers.SerializerMethodField()
    entry_count = serializers.SerializerMethodField()

    class Meta:
        model = VendorPayout
        fields = [
            "id",
            "vendor",
            "vendor_email",
            "vendor_name",
            "store_name",
            "amount",
            "status",
            "reference",
            "period_start",
            "period_end",
            "paid_at",
            "created_at",
            "entry_count",
        ]

    def get_vendor_name(self, obj):
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip()

    def get_store_name(self, obj):
        store = obj.vendor.vendorstore_set.first()
        return store.name if store else ""

    def get_entry_count(self, obj):
        return obj.entries.count()


class AdminPayoutCreateSerializer(serializers.Serializer):
    vendor = serializers.IntegerField()
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, min_value=Decimal("0.00")
    )
    reference = serializers.CharField(required=False, allow_blank=True)
    period_start = serializers.DateField(required=False, allow_null=True)
    period_end = serializers.DateField(required=False, allow_null=True)
