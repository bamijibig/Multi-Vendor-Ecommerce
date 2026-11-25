from __future__ import annotations

import csv
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from io import StringIO

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone

from products.models import CompletedOder, CompletedOderItems

from .models import CategoryCommissionRule, TaxConfiguration, VendorLedgerEntry, VendorPayout

TWOPLACES = Decimal("0.01")
DEFAULT_COMMISSION_RATE = Decimal("10.00")


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def get_active_tax_config() -> TaxConfiguration:
    config = TaxConfiguration.objects.filter(is_active=True).order_by("-updated_at").first()
    if config is None:
        config = TaxConfiguration.objects.create(is_active=True)
    return config


def get_commission_rule(category):
    if category is None:
        return None
    return CategoryCommissionRule.objects.filter(category=category, is_active=True).first()


def commission_rate_for(category) -> Decimal:
    rule = get_commission_rule(category)
    if rule is None:
        return DEFAULT_COMMISSION_RATE
    return money(rule.commission_rate)


def shipping_fee_for(category, quantity: int = 1) -> Decimal:
    rule = get_commission_rule(category)
    if rule is None:
        return Decimal("0.00")
    return money(rule.shipping_contribution_fee * quantity)


def record_completed_order(completed_order: CompletedOder):
    if VendorLedgerEntry.objects.filter(
        completed_order=completed_order, entry_type=VendorLedgerEntry.ENTRY_DELIVERY
    ).exists():
        return list(
            VendorLedgerEntry.objects.filter(
                completed_order=completed_order, entry_type=VendorLedgerEntry.ENTRY_DELIVERY
            )
        )

    tax_config = get_active_tax_config()
    vat_rate = money(tax_config.vat_rate)
    entries = []

    for item in completed_order.delivered_items.select_related(
        "product__categories", "product__vendor_stores__user"
    ):
        product = item.product
        store = product.vendor_stores
        vendor = store.user if store else None
        if vendor is None:
            continue
        category = product.categories
        rate = commission_rate_for(category)
        gross = money(item.total_price)
        if gross <= 0 and product.discounted_price:
            gross = money(product.discounted_price * item.quantity)
        commission = money(gross * rate / Decimal("100"))
        shipping_fee = shipping_fee_for(category, item.quantity)
        vat_on_commission = money(commission * vat_rate / Decimal("100"))
        vat_on_shipping = money(shipping_fee * vat_rate / Decimal("100"))
        net = money(gross - commission - vat_on_commission - shipping_fee - vat_on_shipping)

        entry = VendorLedgerEntry.objects.create(
            vendor=vendor,
            store=store,
            completed_order=completed_order,
            completed_order_item=item,
            product=product,
            entry_type=VendorLedgerEntry.ENTRY_DELIVERY,
            gross_item_amount=gross,
            commission_rate=rate,
            commission_amount=commission,
            vat_rate=vat_rate,
            vat_on_commission=vat_on_commission,
            shipping_fee_deduction=shipping_fee,
            vat_on_shipping=vat_on_shipping,
            net_vendor_earning=net,
            payout_status=VendorLedgerEntry.AVAILABLE_FOR_PAYOUT,
        )
        entries.append(entry)
    return entries


def reverse_completed_order(completed_order: CompletedOder, reason: str = "", item=None):
    delivery_qs = VendorLedgerEntry.objects.filter(
        completed_order=completed_order, entry_type=VendorLedgerEntry.ENTRY_DELIVERY
    )
    reversal_qs = VendorLedgerEntry.objects.filter(
        completed_order=completed_order, entry_type=VendorLedgerEntry.ENTRY_REVERSAL
    )
    if item is not None:
        delivery_qs = delivery_qs.filter(completed_order_item=item)
        reversal_qs = reversal_qs.filter(completed_order_item=item)
    deliveries = list(delivery_qs)
    if not deliveries:
        return []
    existing = list(reversal_qs)
    if existing:
        return existing

    reversals = []
    for original in deliveries:
        original.payout_status = VendorLedgerEntry.REVERSED_ON_RETURN
        original.save(update_fields=["payout_status"])
        reversal = VendorLedgerEntry.objects.create(
            vendor=original.vendor,
            store=original.store,
            completed_order=completed_order,
            completed_order_item=original.completed_order_item,
            product=original.product,
            entry_type=VendorLedgerEntry.ENTRY_REVERSAL,
            gross_item_amount=-original.gross_item_amount,
            commission_rate=original.commission_rate,
            commission_amount=-original.commission_amount,
            vat_rate=original.vat_rate,
            vat_on_commission=-original.vat_on_commission,
            shipping_fee_deduction=-original.shipping_fee_deduction,
            vat_on_shipping=-original.vat_on_shipping,
            net_vendor_earning=-original.net_vendor_earning,
            payout_status=VendorLedgerEntry.REVERSED_ON_RETURN,
            reversal_reason=reason,
        )
        reversals.append(reversal)
    return reversals


def vendor_balances(vendor, start=None, end=None):
    queryset = VendorLedgerEntry.objects.filter(vendor=vendor)
    if start:
        queryset = queryset.filter(created_at__date__gte=start)
    if end:
        queryset = queryset.filter(created_at__date__lte=end)

    pending = Decimal("0.00")
    available = Decimal("0.00")
    paid = Decimal("0.00")
    for status_name, amount in queryset.values_list("payout_status", "net_vendor_earning"):
        value = money(amount)
        if status_name == VendorLedgerEntry.PENDING_CLEARANCE:
            pending += value
        elif status_name == VendorLedgerEntry.AVAILABLE_FOR_PAYOUT:
            available += value
        elif status_name == VendorLedgerEntry.PAID:
            paid += value
        elif status_name == VendorLedgerEntry.REVERSED_ON_RETURN:
            # Reversals are already represented as negative delivery adjustments
            # when created; do not double-count them in wallet buckets.
            pass
    return {
        "pending_clearance": money(pending),
        "available_for_payout": money(available),
        "total_paid": money(paid),
    }


def vendor_statement(vendor, start=None, end=None, payout_status=None):
    queryset = VendorLedgerEntry.objects.filter(vendor=vendor).select_related(
        "product", "completed_order"
    )
    if start:
        queryset = queryset.filter(created_at__date__gte=start)
    if end:
        queryset = queryset.filter(created_at__date__lte=end)
    if payout_status:
        queryset = queryset.filter(payout_status=payout_status)
    return queryset.order_by("-created_at")


def statement_csv(entries):
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "date",
            "order",
            "product",
            "entry_type",
            "gross_item_amount",
            "commission_rate",
            "commission_amount",
            "vat_rate",
            "vat_on_commission",
            "shipping_fee_deduction",
            "vat_on_shipping",
            "net_vendor_earning",
            "payout_status",
        ]
    )
    for entry in entries:
        writer.writerow(
            [
                entry.created_at.date().isoformat(),
                getattr(entry.completed_order, "oder_number", ""),
                getattr(entry.product, "title", ""),
                entry.entry_type,
                entry.gross_item_amount,
                entry.commission_rate,
                entry.commission_amount,
                entry.vat_rate,
                entry.vat_on_commission,
                entry.shipping_fee_deduction,
                entry.vat_on_shipping,
                entry.net_vendor_earning,
                entry.payout_status,
            ]
        )
    return buffer.getvalue()


def finance_summary(start=None, end=None):
    queryset = VendorLedgerEntry.objects.filter(entry_type=VendorLedgerEntry.ENTRY_DELIVERY)
    if start:
        queryset = queryset.filter(created_at__date__gte=start)
    if end:
        queryset = queryset.filter(created_at__date__lte=end)
    gmv = Decimal("0.00")
    commission = Decimal("0.00")
    vat = Decimal("0.00")
    shipping = Decimal("0.00")
    vat_shipping = Decimal("0.00")
    net = Decimal("0.00")
    for row in queryset.values_list(
        "gross_item_amount",
        "commission_amount",
        "vat_on_commission",
        "shipping_fee_deduction",
        "vat_on_shipping",
        "net_vendor_earning",
    ):
        gmv += money(row[0])
        commission += money(row[1])
        vat += money(row[2])
        shipping += money(row[3])
        vat_shipping += money(row[4])
        net += money(row[5])
    return {
        "gmv": money(gmv),
        "commission_earned": money(commission),
        "vat_on_commission": money(vat),
        "shipping_contribution": money(shipping),
        "vat_on_shipping": money(vat_shipping),
        "total_vat_collected": money(vat + vat_shipping),
        "net_vendor_earnings": money(net),
        "ledger_entries": queryset.count(),
    }