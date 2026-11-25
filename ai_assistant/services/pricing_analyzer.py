"""Ground listing prices in products already present in the marketplace."""

from __future__ import annotations

import statistics
from decimal import Decimal
from typing import Any

from products.models import Categories, Product

CONDITION_MULTIPLIERS = {
    "new": 1.0,
    "like_new": 0.9,
    "refurbished": 0.82,
    "used": 0.75,
}

CURRENCY_SYMBOLS = {"NGN": "₦", "USD": "$", "GBP": "£", "EUR": "€"}


def format_money(value: int | float | None, currency: str = "NGN") -> str:
    if value is None:
        return "—"
    symbol = CURRENCY_SYMBOLS.get(currency.upper(), f"{currency.upper()} ")
    return f"{symbol}{round(value):,}"


def analyze_category_pricing(
    category: Categories | None = None,
    *,
    condition: str = "new",
    currency: str = "NGN",
) -> dict[str, Any]:
    """Return a market range and a condition-adjusted suggested price.

    Prices come from the existing ``Product`` table. If the requested category
    has no products the analyzer deliberately does not fabricate a price; the
    vendor sees a manual-pricing note instead.
    """
    queryset = Product.objects.all()
    scope = "your category"
    if category is not None:
        queryset = queryset.filter(categories=category)
        scope = category.name
    else:
        scope = "the catalogue"

    prices = []
    for regular_price, discount_percent in queryset.values_list(
        "regular_price", "discounted_parcent"
    )[:500]:
        try:
            price = float(regular_price) * (1 - float(discount_percent or 0) / 100)
        except (TypeError, ValueError):
            continue
        if price > 0:
            prices.append(price)

    def _estimates(price):
        try:
            from finance.services import (
                commission_rate_for,
                get_active_tax_config,
                money,
                shipping_fee_for,
            )

            tax_config = get_active_tax_config()
            vat_rate = money(tax_config.vat_rate)
            rate = commission_rate_for(category)
            shipping_fee = shipping_fee_for(category, 1)
            commission = money(Decimal(str(price)) * rate / Decimal("100"))
            vat_on_commission = money(commission * vat_rate / Decimal("100"))
            vat_on_shipping = money(shipping_fee * vat_rate / Decimal("100"))
            net = money(
                Decimal(str(price))
                - commission
                - vat_on_commission
                - shipping_fee
                - vat_on_shipping
            )
            return {
                "estimated_commission_rate": float(rate),
                "estimated_commission": float(commission),
                "estimated_vat_rate": float(vat_rate),
                "estimated_vat_on_commission": float(vat_on_commission),
                "estimated_shipping_fee": float(shipping_fee),
                "estimated_vat_on_shipping": float(vat_on_shipping),
                "estimated_net_payout": float(net),
            }
        except Exception:  # noqa: BLE001 - finance is optional for pricing display
            return {
                "estimated_commission_rate": None,
                "estimated_commission": None,
                "estimated_vat_rate": None,
                "estimated_vat_on_commission": None,
                "estimated_shipping_fee": None,
                "estimated_vat_on_shipping": None,
                "estimated_net_payout": None,
            }

    if not prices:
        estimates = _estimates(0)
        return {
            "currency": currency.upper(),
            "suggested_price": None,
            "market_min": None,
            "market_max": None,
            "market_median": None,
            "sample_size": 0,
            "scope": scope,
            "notes": (
                f"No comparable products were found in {scope}. Add a selling "
                "price manually before publishing."
            ),
            **estimates,
        }

    minimum = round(min(prices))
    maximum = round(max(prices))
    median = round(statistics.median(prices))
    multiplier = CONDITION_MULTIPLIERS.get(condition, 1.0)
    suggested = max(1, round(median * multiplier))
    condition_label = condition.replace("_", " ").title()
    estimates = _estimates(suggested)

    return {
        "currency": currency.upper(),
        "suggested_price": suggested,
        "market_min": minimum,
        "market_max": maximum,
        "market_median": median,
        "sample_size": len(prices),
        "scope": scope,
        "notes": (
            f"Based on {len(prices)} comparable product(s) in {scope}: "
            f"{format_money(minimum, currency)} – {format_money(maximum, currency)} "
            f"(median {format_money(median, currency)}). The {condition_label.lower()} "
            f"condition suggestion applies a {round(multiplier * 100)}% market factor."
        ),
        **estimates,
    }
