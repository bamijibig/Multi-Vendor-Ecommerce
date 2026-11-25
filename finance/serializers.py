from rest_framework import serializers

from .models import CategoryCommissionRule, TaxConfiguration, VendorLedgerEntry, VendorPayout


class CategoryCommissionRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = CategoryCommissionRule
        fields = [
            "id",
            "category",
            "category_name",
            "commission_rate",
            "shipping_contribution_fee",
            "is_active",
            "created_at",
            "updated_at",
        ]


class TaxConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxConfiguration
        fields = [
            "id",
            "name",
            "vat_rate",
            "wht_rate",
            "wht_enabled",
            "is_active",
            "created_at",
            "updated_at",
        ]


class VendorLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorLedgerEntry
        fields = [
            "id",
            "entry_type",
            "completed_order",
            "completed_order_item",
            "product",
            "gross_item_amount",
            "commission_rate",
            "commission_amount",
            "vat_rate",
            "vat_on_commission",
            "shipping_fee_deduction",
            "vat_on_shipping",
            "net_vendor_earning",
            "payout_status",
            "payout",
            "reversal_reason",
            "created_at",
        ]


class VendorPayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorPayout
        fields = [
            "id",
            "amount",
            "status",
            "reference",
            "period_start",
            "period_end",
            "paid_at",
            "created_at",
        ]