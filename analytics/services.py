from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Sum
from django.utils import timezone

from products.models import CompletedOderItems, Product
from Vendors.models import VendorStore

from finance.models import VendorLedgerEntry
from finance.services import money

from .models import ProductViewEvent


def parse_range(range_value, start=None, end=None):
    today = timezone.now().date()
    if range_value == "7d":
        start_date = today - timedelta(days=6)
        end_date = today
    elif range_value == "90d":
        start_date = today - timedelta(days=89)
        end_date = today
    elif range_value == "custom" and start and end:
        start_date = start
        end_date = end
    else:
        start_date = today - timedelta(days=29)
        end_date = today
    previous_end = start_date - timedelta(days=1)
    previous_start = previous_end - (end_date - start_date)
    return start_date, end_date, previous_start, previous_end


def _vendor_products(vendor):
    return Product.objects.filter(vendor_stores__user=vendor)


def track_product_view(product, user=None, session_key=""):
    return ProductViewEvent.objects.create(
        product=product, user=user, session_key=session_key or ""
    )


def calculate_seller_score(vendor, start_date, end_date):
    products = _vendor_products(vendor)
    delivered_items = CompletedOderItems.objects.filter(
        product__vendor_stores__user=vendor,
        completed_oder__complete_date__date__gte=start_date,
        completed_oder__complete_date__date__lte=end_date,
    )
    delivered_count = delivered_items.count()
    reversed_count = VendorLedgerEntry.objects.filter(
        vendor=vendor,
        entry_type=VendorLedgerEntry.ENTRY_REVERSAL,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    ).count()

    reviews = products.aggregate(avg=Avg("productstarratingandreview__stars")) if False else None
    from products.models import ProductStarRatingAndReview

    review_qs = ProductStarRatingAndReview.objects.filter(product__vendor_stores__user=vendor)
    avg_rating = review_qs.aggregate(avg=Avg("stars"))["avg"]
    avg_rating = float(avg_rating) if avg_rating is not None else 5.0

    cancellation_rate = 0.0
    late_shipment_rate = 0.0
    return_rate = (reversed_count / delivered_count) if delivered_count else 0.0

    cancellation_penalty = min(1.5, cancellation_rate * 3.0)
    late_penalty = min(1.0, late_shipment_rate * 2.0)
    return_penalty = min(1.5, return_rate * 3.0)
    review_penalty = min(2.0, max(0.0, (5.0 - avg_rating) * 0.4))
    total_penalty = cancellation_penalty + late_penalty + return_penalty + review_penalty
    score = max(0.0, min(5.0, 5.0 - total_penalty))

    warnings = []
    if score < 3.0:
        warnings.append("Seller score is below 3.0; review fulfillment and quality issues.")
    if return_rate >= 0.1:
        warnings.append("Return/refund rate is high.")
    if avg_rating < 4.0:
        warnings.append("Average buyer rating is below 4.0.")
    if delivered_count == 0:
        warnings.append("No completed sales in this period.")

    return {
        "score": round(score, 2),
        "average_rating": round(avg_rating, 2),
        "cancellation_rate": round(cancellation_rate, 4),
        "late_shipment_rate": round(late_shipment_rate, 4),
        "return_rate": round(return_rate, 4),
        "penalties": {
            "cancellation": round(cancellation_penalty, 2),
            "late_shipment": round(late_penalty, 2),
            "returns": round(return_penalty, 2),
            "reviews": round(review_penalty, 2),
            "total": round(total_penalty, 2),
        },
        "warnings": warnings,
    }


def vendor_dashboard(vendor, start_date, end_date, previous_start, previous_end):
    store = VendorStore.objects.filter(user=vendor).first()
    items = CompletedOderItems.objects.filter(
        product__vendor_stores__user=vendor,
        completed_oder__complete_date__date__gte=start_date,
        completed_oder__complete_date__date__lte=end_date,
    ).select_related("product", "completed_oder")
    previous_items = CompletedOderItems.objects.filter(
        product__vendor_stores__user=vendor,
        completed_oder__complete_date__date__gte=previous_start,
        completed_oder__complete_date__date__lte=previous_end,
    )

    gmv = sum((money_decimal(item.total_price) for item in items), Decimal("0.00"))
    previous_gmv = sum((money_decimal(item.total_price) for item in previous_items), Decimal("0.00"))
    units_sold = items.aggregate(total=Sum("quantity"))["total"] or 0
    order_count = items.values("completed_oder_id").distinct().count()
    aov = (gmv / order_count) if order_count else Decimal("0.00")
    growth = 0.0
    if previous_gmv > 0:
        growth = float((gmv - previous_gmv) / previous_gmv * 100)

    net_earnings = VendorLedgerEntry.objects.filter(
        vendor=vendor,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    ).aggregate(total=Sum("net_vendor_earning"))["total"] or Decimal("0.00")

    product_ids = list(_vendor_products(vendor).values_list("id", flat=True))
    views_count = ProductViewEvent.objects.filter(
        product_id__in=product_ids,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    ).count()
    conversion_rate = (order_count / views_count * 100) if views_count else 0.0

    top_skus = []
    for product in _vendor_products(vendor):
        product_items = [item for item in items if item.product_id == product.id]
        if not product_items:
            continue
        revenue = sum((money_decimal(item.total_price) for item in product_items), Decimal("0.00"))
        units = sum(item.quantity for item in product_items)
        top_skus.append(
            {
                "product_id": product.id,
                "title": product.title,
                "slug": product.slug,
                "revenue": float(revenue),
                "units": units,
                "stock": product.stoc,
            }
        )
    top_skus.sort(key=lambda row: row["revenue"], reverse=True)

    low_stock = [
        {"product_id": p.id, "title": p.title, "stock": p.stoc}
        for p in _vendor_products(vendor)
        if p.stoc <= 5
    ]

    high_returns = []
    reversed_entries = VendorLedgerEntry.objects.filter(
        vendor=vendor,
        entry_type=VendorLedgerEntry.ENTRY_REVERSAL,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    ).select_related("product")
    return_counts = {}
    for entry in reversed_entries:
        if entry.product_id:
            return_counts[entry.product_id] = return_counts.get(entry.product_id, 0) + 1
    for product_id, count in return_counts.items():
        product = Product.objects.filter(pk=product_id).first()
        if product:
            high_returns.append({"product_id": product.id, "title": product.title, "returns": count})

    return {
        "range": {"start": str(start_date), "end": str(end_date)},
        "gmv": float(gmv),
        "net_earnings": float(net_earnings),
        "units_sold": units_sold,
        "order_count": order_count,
        "average_order_value": float(aov),
        "growth_percent": round(growth, 2),
        "funnel": {
            "product_views": views_count,
            "orders": order_count,
            "conversion_rate": round(conversion_rate, 2),
        },
        "seller_score": calculate_seller_score(vendor, start_date, end_date),
        "top_skus": top_skus[:10],
        "low_stock_skus": low_stock[:10],
        "high_return_skus": high_returns[:10],
    }


def money_decimal(value):
    from decimal import Decimal

    return Decimal(str(value or 0))