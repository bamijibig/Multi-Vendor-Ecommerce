from django.contrib import admin

from .models import BulkUploadBatch, ProductDraft


@admin.register(BulkUploadBatch)
class BulkUploadBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "vendor", "store", "status", "total_rows", "processed_rows", "failed_rows", "created_at")
    list_filter = ("status", "store")
    search_fields = ("vendor__email", "store__name")


@admin.register(ProductDraft)
class ProductDraftAdmin(admin.ModelAdmin):
    list_display = ("title", "vendor", "store", "status", "price", "created_at")
    list_filter = ("status", "condition", "store")
    search_fields = ("title", "vendor__email", "store__name")
    readonly_fields = (
        "prompt",
        "provider_used",
        "ai_note",
        "ai_payload",
        "suggested_price",
        "market_min",
        "market_max",
        "market_median",
        "market_sample_size",
        "published_product",
        "published_at",
        "created_at",
        "updated_at",
    )
