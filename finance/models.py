from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from products.models import Categories
from Vendors.models import VendorStore


class CategoryCommissionRule(models.Model):
    category = models.OneToOneField(
        Categories, on_delete=models.CASCADE, related_name="commission_rule"
    )
    commission_rate = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("10.00"))
    shipping_contribution_fee = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.category.name}: {self.commission_rate}%"


class TaxConfiguration(models.Model):
    name = models.CharField(max_length=80, default="Default marketplace tax")
    vat_rate = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("7.50"))
    wht_rate = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    wht_enabled = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_active", "-updated_at"]

    def __str__(self):
        return f"{self.name} (VAT {self.vat_rate}%)"


class VendorLedgerEntry(models.Model):
    PENDING_CLEARANCE = "PENDING_CLEARANCE"
    AVAILABLE_FOR_PAYOUT = "AVAILABLE_FOR_PAYOUT"
    PAID = "PAID"
    REVERSED_ON_RETURN = "REVERSED_ON_RETURN"
    PAYOUT_STATUS_CHOICES = [
        (PENDING_CLEARANCE, "Pending clearance"),
        (AVAILABLE_FOR_PAYOUT, "Available for payout"),
        (PAID, "Paid"),
        (REVERSED_ON_RETURN, "Reversed on return"),
    ]

    ENTRY_DELIVERY = "DELIVERY"
    ENTRY_REVERSAL = "REVERSAL"
    ENTRY_TYPE_CHOICES = [
        (ENTRY_DELIVERY, "Delivery"),
        (ENTRY_REVERSAL, "Reversal"),
    ]

    vendor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ledger_entries"
    )
    store = models.ForeignKey(
        VendorStore, on_delete=models.CASCADE, related_name="ledger_entries"
    )
    completed_order = models.ForeignKey(
        "products.CompletedOder", on_delete=models.CASCADE, related_name="ledger_entries"
    )
    completed_order_item = models.ForeignKey(
        "products.CompletedOderItems", on_delete=models.CASCADE, related_name="ledger_entries", null=True, blank=True
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.SET_NULL, null=True, blank=True
    )
    entry_type = models.CharField(max_length=20, choices=ENTRY_TYPE_CHOICES, default=ENTRY_DELIVERY)
    gross_item_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    commission_rate = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    vat_rate = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("7.50"))
    vat_on_commission = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    shipping_fee_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    vat_on_shipping = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    net_vendor_earning = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    payout_status = models.CharField(
        max_length=30, choices=PAYOUT_STATUS_CHOICES, default=AVAILABLE_FOR_PAYOUT
    )
    payout = models.ForeignKey(
        "VendorPayout", on_delete=models.SET_NULL, null=True, blank=True, related_name="entries"
    )
    reversal_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.vendor.email} {self.entry_type} {self.net_vendor_earning}"


class VendorPayout(models.Model):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    STATUS_CHOICES = [(PENDING, "Pending"), (PAID, "Paid"), (FAILED, "Failed")]

    vendor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payouts"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    reference = models.CharField(max_length=120, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.vendor.email} {self.amount} ({self.status})"