"""Buyer shopping concierge: natural language to a ranked, stock-safe cart."""

from __future__ import annotations

import math
import os
import re
from typing import Any

from django.conf import settings
from django.db.models import Avg, Count, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework.exceptions import ValidationError

from api.services import set_cart_item
from products.models import (
    Cart,
    CompletedOderItems,
    CustomerAddress,
    PlacedeOderItem,
    Product,
)
from Vendors.models import VendorStore

from .pricing_analyzer import format_money

_STOP_WORDS = {
    "about",
    "after",
    "also",
    "and",
    "any",
    "are",
    "around",
    "best",
    "budget",
    "buy",
    "can",
    "could",
    "for",
    "from",
    "get",
    "good",
    "have",
    "help",
    "looking",
    "need",
    "please",
    "product",
    "products",
    "shop",
    "shopping",
    "some",
    "that",
    "the",
    "this",
    "under",
    "want",
    "with",
    "within",
    "would",
    "you",
}


def _currency_from_prompt(prompt: str, default: str = "NGN") -> str:
    lowered = (prompt or "").lower()
    if "₦" in lowered or "naira" in lowered or re.search(r"\bngn\b", lowered):
        return "NGN"
    if "$" in lowered or re.search(r"\busd\b", lowered) or "dollar" in lowered:
        return "USD"
    return (default or "NGN").upper()


def parse_budget_from_prompt(prompt: str) -> int | None:
    """Extract a budget without confusing model numbers or quantities for money."""
    text = (prompt or "").lower().replace(",", "")
    patterns = [
        r"(?:₦|ngn|naira|\$|usd)\s*([0-9]+(?:\.[0-9]+)?)\s*(k|m|thousand|million)?",
        r"([0-9]+(?:\.[0-9]+)?)\s*(k|m|thousand|million)?\s*(?:naira|ngn|₦|dollars?|usd)",
        (
            r"(?:under|below|less than|within|up to|max(?:imum)?(?: of)?|"
            r"budget(?: of| is| around)?)[^0-9]{0,20}"
            r"([0-9]+(?:\.[0-9]+)?)\s*(k|m|thousand|million)?"
        ),
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        try:
            value = float(match.group(1))
        except (TypeError, ValueError):
            continue
        suffix = (match.group(2) or "").lower()
        if suffix in {"k", "thousand"}:
            value *= 1_000
        elif suffix in {"m", "million"}:
            value *= 1_000_000
        if value > 0:
            return int(round(value))
    return None


def extract_keywords(prompt: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9][a-zA-Z0-9+'-]{2,}", prompt or "")
    keywords: list[str] = []
    for word in words:
        clean = word.strip("-'").lower()
        if clean and clean not in _STOP_WORDS and clean not in keywords:
            keywords.append(clean)
    return keywords[:12]


def _candidate_queryset():
    placed_sales = (
        PlacedeOderItem.objects.filter(product=OuterRef("pk"))
        .values("product")
        .annotate(total=Sum("quantity"))
        .values("total")
    )
    completed_sales = (
        CompletedOderItems.objects.filter(product=OuterRef("pk"))
        .values("product")
        .annotate(total=Sum("quantity"))
        .values("total")
    )
    return (
        Product.objects.select_related("categories", "categories__industry", "vendor_stores")
        .prefetch_related("productimage_set")
        .annotate(
            avg_rating=Coalesce(
                Avg("productstarratingandreview__stars"), Value(0.0)
            ),
            review_count=Count("productstarratingandreview", distinct=True),
            sold_placed=Coalesce(
                Subquery(placed_sales, output_field=IntegerField()), Value(0)
            ),
            sold_completed=Coalesce(
                Subquery(completed_sales, output_field=IntegerField()), Value(0)
            ),
        )
        .filter(
            out_of_stoc=False,
            stoc__gt=0,
            moderation_status=Product.MODERATION_APPROVED,
        )
        .filter(
            Q(vendor_stores__isnull=True)
            | Q(vendor_stores__status=VendorStore.STATUS_ACTIVE)
        )
    )


def _relevance(product: Product, keywords: list[str], prompt: str) -> float:
    if not keywords:
        return 0.5
    haystack = " ".join(
        [
            product.title or "",
            product.tag or "",
            product.description or "",
            product.details_description or "",
            product.categories.name if product.categories_id else "",
            product.vendor_stores.name if product.vendor_stores_id else "",
        ]
    ).lower()
    matched = sum(1 for keyword in keywords if keyword in haystack)
    score = matched / len(keywords)
    if prompt and product.title and product.title.lower() in prompt.lower():
        score = max(score, 0.9)
    return min(score, 1.0)


def score_candidate(
    *,
    average_rating: float | None,
    review_count: int,
    sold_units: int,
    stock: int,
    quantity: int,
    price: float,
    budget: int | None,
    relevance: float,
) -> dict[str, float]:
    """Pure scoring helper, kept public so ranking is unit-testable."""
    rating = min(max(float(average_rating or 0), 0), 5) / 5
    review_volume = min(
        math.log1p(max(int(review_count or 0), 0)) / math.log1p(20), 1
    )
    sales_volume = min(math.log1p(max(int(sold_units or 0), 0)) / math.log1p(50), 1)
    stock_score = 1.0 if stock >= quantity else 0.0
    price_fit = 1.0 if budget is None or price <= budget else 0.0

    quality = (
        rating * 0.35
        + review_volume * 0.2
        + sales_volume * 0.3
        + stock_score * 0.15
    )
    final = quality * 0.65 + min(max(relevance, 0), 1) * 0.25 + price_fit * 0.1
    return {
        "rating": round(rating, 4),
        "review_volume": round(review_volume, 4),
        "sales_volume": round(sales_volume, 4),
        "stock": round(stock_score, 4),
        "price_fit": round(price_fit, 4),
        "quality": round(quality, 4),
        "relevance": round(min(max(relevance, 0), 1), 4),
        "final": round(final, 4),
    }


def _reasons(
    *,
    average_rating: float | None,
    review_count: int,
    sold_units: int,
    stock: int,
    price: float,
    budget: int | None,
    currency: str,
) -> list[str]:
    reasons: list[str] = []
    if review_count:
        reasons.append(
            f"{float(average_rating or 0):.1f}★ average from {review_count} review(s)"
        )
    else:
        reasons.append("No reviews yet; ranked on availability and sales signals")
    reasons.append(
        f"{sold_units} unit(s) sold" if sold_units else "No sales history yet"
    )
    if budget is not None:
        reasons.append(f"Fits the {format_money(budget, currency)} total budget")
    else:
        reasons.append(f"Priced at {format_money(price, currency)}")
    reasons.append(f"{stock} unit(s) in stock")
    return reasons


def source_and_build_cart(
    *,
    user,
    prompt: str,
    budget: int | None = None,
    max_items: int = 4,
    quantity: int = 1,
    currency: str = "NGN",
) -> dict[str, Any]:
    """Parse a request, rank products and set the selected cart quantities.

    Existing cart rows are updated (not duplicated) through
    ``api.services.set_cart_item``. Unrelated cart items are intentionally left
    alone; the response exposes only the AI-selected breakdown.
    """
    prompt = (prompt or "").strip()
    if not prompt:
        raise ValidationError({"prompt": "Tell the concierge what you are shopping for."})

    max_items = max(1, min(int(max_items or 4), 8))
    quantity = max(1, min(int(quantity or 1), 10))
    currency = _currency_from_prompt(prompt, currency)
    if budget is None:
        budget = parse_budget_from_prompt(prompt)
    if budget is not None:
        try:
            budget = int(budget)
        except (TypeError, ValueError):
            raise ValidationError({"budget": "Budget must be a number."})
        if budget <= 0:
            raise ValidationError({"budget": "Budget must be greater than zero."})

    keywords = extract_keywords(prompt)
    queryset = _candidate_queryset()
    fallback_used = False
    matched = queryset
    if keywords:
        query = Q()
        for keyword in keywords:
            query |= Q(title__icontains=keyword)
            query |= Q(tag__icontains=keyword)
            query |= Q(description__icontains=keyword)
            query |= Q(categories__name__icontains=keyword)
            query |= Q(vendor_stores__name__icontains=keyword)
            query |= Q(productstarratingandreview__review_message__icontains=keyword)
        matched = queryset.filter(query).distinct()
        if not matched.exists():
            matched = queryset
            fallback_used = True

    candidates = list(matched[:200])
    if not candidates:
        raise ValidationError(
            {"prompt": "No in-stock products are available for that request yet."}
        )

    ranked: list[dict[str, Any]] = []
    for product in candidates:
        price = float(product.discounted_price)
        relevance = _relevance(product, keywords, prompt)
        sold_units = int(product.sold_placed or 0) + int(product.sold_completed or 0)
        breakdown = score_candidate(
            average_rating=product.avg_rating,
            review_count=product.review_count,
            sold_units=sold_units,
            stock=product.stoc,
            quantity=quantity,
            price=price,
            budget=budget,
            relevance=relevance,
        )
        ranked.append(
            {
                "product": product,
                "price": price,
                "sold_units": sold_units,
                "reasons": _reasons(
                    average_rating=product.avg_rating,
                    review_count=product.review_count,
                    sold_units=sold_units,
                    stock=product.stoc,
                    price=price,
                    budget=budget,
                    currency=currency,
                ),
                "score_breakdown": breakdown,
                "score": breakdown["final"],
            }
        )

    ranked.sort(key=lambda entry: (-entry["score"], entry["price"], entry["product"].id))

    selected: list[dict[str, Any]] = []
    selected_ids: set[int] = set()
    remaining = budget
    for entry in ranked:
        if len(selected) >= max_items:
            break
        product = entry["product"]
        price = entry["price"]
        item_quantity = quantity
        if budget is not None:
            if remaining is None or price > remaining:
                continue
            item_quantity = min(item_quantity, int(remaining // price))
        item_quantity = min(item_quantity, product.stoc)
        if item_quantity < 1:
            continue
        cart_item = set_cart_item(user, product, item_quantity)
        selected.append(
            {
                **entry,
                "quantity": item_quantity,
                "cart_item": cart_item,
                "line_total": round(price * item_quantity, 2),
            }
        )
        selected_ids.add(product.id)
        if budget is not None:
            remaining = max(0, int(round(remaining - price * item_quantity)))

    if not selected:
        if budget is not None:
            raise ValidationError(
                {
                    "budget": (
                        f"No in-stock products fit the {format_money(budget, currency)} "
                        "budget. Try increasing it or removing a constraint."
                    )
                }
            )
        raise ValidationError({"prompt": "No matching products could be selected."})

    # Give the client a small, relevant swap list without exposing the whole
    # catalogue or making every selection carry the same 200 products.
    alternatives_pool = [entry for entry in ranked if entry["product"].id not in selected_ids]
    for selection in selected:
        selection["alternatives"] = [
            {**alternative, "product": alternative["product"]}
            for alternative in alternatives_pool[:3]
        ]

    return {
        "success": True,
        "prompt": prompt,
        "keywords": keywords,
        "currency": currency,
        "budget": budget,
        "remaining_budget": remaining,
        "max_items": max_items,
        "quantity": quantity,
        "fallback_used": fallback_used,
        "candidate_count": len(candidates),
        "selections": selected,
        "selected_total": round(sum(item["line_total"] for item in selected), 2),
    }


def prepare_checkout(user, address_id: int | None = None) -> dict[str, Any]:
    """Validate stock/address and pin a shipping address without charging."""
    items = list(
        Cart.objects.select_related("product", "shipping_address")
        .filter(user=user)
        .order_by("id")
    )
    if not items:
        raise ValidationError({"cart": "Your cart is empty."})

    for item in items:
        product = item.product
        if product.out_of_stoc or product.stoc < item.quantity:
            raise ValidationError(
                {
                    "cart": (
                        f"'{product.title[:50]}' is out of stock or has only "
                        f"{product.stoc} unit(s) left."
                    )
                }
            )

    address = None
    if address_id is not None:
        address = CustomerAddress.objects.filter(pk=address_id, user=user).first()
        if address is None:
            raise ValidationError({"shipping_address": "Shipping address not found."})
    elif items[0].shipping_address_id:
        address = items[0].shipping_address

    if address is not None:
        Cart.objects.filter(user=user).update(shipping_address=address)

    stripe_key = (
        getattr(settings, "STRIPE_SECRET_KEY", "") or os.getenv("STRIPE_SECRET_KEY", "")
    )
    subtotal = round(Cart.subtotal_product_price(user), 2)
    return {
        "success": True,
        "checkout_ready": address is not None,
        "missing": [] if address is not None else ["shipping_address"],
        "subtotal": subtotal,
        "currency": "NGN",
        "address": (
            {
                "id": address.id,
                "street_address": address.street_address,
                "city": address.city,
                "state": address.state,
                "zip_code": address.zip_code,
                "mobile": address.mobile,
            }
            if address is not None
            else None
        ),
        "payment": {
            "provider": "stripe",
            "configured": bool(stripe_key),
            "auto_charge": False,
            "next_step": "/payment",
            "message": (
                "Stock and address validated. Review the total, then confirm "
                "payment explicitly on the payment step."
            ),
        },
    }
