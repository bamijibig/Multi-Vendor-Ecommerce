from rest_framework import serializers

from api.serializers import ProductListSerializer
from api.utils import absolute_image_url, build_media_url
from products.models import Categories

from .models import BulkUploadBatch, ProductDraft


class BuyerSourcingSerializer(serializers.Serializer):
    prompt = serializers.CharField(
        max_length=2000,
        help_text="Natural-language shopping request.",
    )
    budget = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=1,
        max_value=10_000_000_000,
        help_text="Optional total budget. Defaults to NGN when relevant.",
    )
    max_items = serializers.IntegerField(
        required=False, min_value=1, max_value=8, default=4
    )
    quantity = serializers.IntegerField(
        required=False, min_value=1, max_value=10, default=1
    )
    currency = serializers.ChoiceField(
        required=False,
        choices=["NGN", "USD", "GBP", "EUR"],
        default="NGN",
    )


class PrepareCheckoutSerializer(serializers.Serializer):
    address_id = serializers.IntegerField(required=False, allow_null=True)


class SellerListingSerializer(serializers.Serializer):
    prompt = serializers.CharField(max_length=2000)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Categories.objects.all(), required=False, allow_null=True
    )
    condition = serializers.ChoiceField(
        choices=ProductDraft.CONDITION_CHOICES, default=ProductDraft.CONDITION_NEW
    )
    store_id = serializers.IntegerField(required=False, allow_null=True)
    currency = serializers.ChoiceField(
        required=False,
        choices=["NGN", "USD", "GBP", "EUR"],
        default="NGN",
    )


class ProductDraftSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    store_name = serializers.CharField(source="store.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    condition_display = serializers.CharField(
        source="get_condition_display", read_only=True
    )
    image = serializers.FileField(
        required=False, allow_null=True, write_only=True
    )
    image_url = serializers.SerializerMethodField()
    bulk_batch_id = serializers.IntegerField(source="bulk_batch.id", read_only=True)
    published_product = ProductListSerializer(read_only=True)

    class Meta:
        model = ProductDraft
        fields = [
            "id",
            "status",
            "status_display",
            "store",
            "store_name",
            "title",
            "description",
            "details_description",
            "category",
            "category_name",
            "condition",
            "condition_display",
            "tag",
            "modle",
            "price",
            "suggested_price",
            "market_min",
            "market_max",
            "market_median",
            "market_sample_size",
            "currency",
            "stock",
            "discount_percent",
            "image",
            "image_url",
            "external_image_url",
            "image_source",
            "sku",
            "bulk_batch_id",
            "prompt",
            "provider_used",
            "ai_note",
            "rejection_reason",
            "published_product",
            "published_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "store",
            "store_name",
            "suggested_price",
            "market_min",
            "market_max",
            "market_median",
            "market_sample_size",
            "currency",
            "prompt",
            "provider_used",
            "ai_note",
            "rejection_reason",
            "published_product",
            "published_at",
            "created_at",
            "updated_at",
        ]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image:
            return absolute_image_url(request, obj.image)
        if obj.external_image_url:
            return obj.external_image_url
        return None

    def validate(self, attrs):
        if self.instance and self.instance.status == ProductDraft.STATUS_PUBLISHED:
            raise serializers.ValidationError(
                {"draft": "Published drafts can no longer be edited."}
            )
        if "discount_percent" in attrs:
            attrs["discount_percent"] = max(0, min(attrs["discount_percent"], 100))
        return attrs


class BulkUploadBatchSerializer(serializers.ModelSerializer):
    excel_file_url = serializers.SerializerMethodField()
    images_zip_url = serializers.SerializerMethodField()
    draft_count = serializers.SerializerMethodField()

    class Meta:
        model = BulkUploadBatch
        fields = [
            "id",
            "status",
            "total_rows",
            "processed_rows",
            "failed_rows",
            "error_report",
            "auto_generate_description",
            "auto_suggest_price",
            "auto_generate_image",
            "excel_file",
            "excel_file_url",
            "images_zip",
            "images_zip_url",
            "draft_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_excel_file_url(self, obj):
        request = self.context.get("request")
        return build_media_url(request, obj.excel_file) if obj.excel_file else None

    def get_images_zip_url(self, obj):
        request = self.context.get("request")
        return build_media_url(request, obj.images_zip) if obj.images_zip else None

    def get_draft_count(self, obj):
        return obj.drafts.count()

