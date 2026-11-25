"""Draft publishing and rejection rules."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from products.models import Product, ProductImage

from ..models import ProductDraft


@transaction.atomic
def publish_draft(*, draft_id: int, vendor) -> tuple[ProductDraft, Product, bool]:
    """Publish a draft into the live catalogue exactly once.

    Returns ``(draft, product, created)``. Re-approving an already published
    draft returns the existing product instead of duplicating it.
    """
    draft = (
        ProductDraft.objects.select_for_update()
        .select_related("store", "category")
        .filter(pk=draft_id, vendor=vendor)
        .first()
    )
    if draft is None:
        raise LookupError("Draft not found.")

    if draft.status == ProductDraft.STATUS_PUBLISHED and draft.published_product_id:
        return draft, draft.published_product, False
    if draft.status == ProductDraft.STATUS_REJECTED:
        raise ValidationError({"draft": "Rejected drafts cannot be published."})
    if not draft.category_id:
        raise ValidationError({"category": "Choose a category before publishing."})
    if not draft.title.strip():
        raise ValidationError({"title": "A title is required before publishing."})
    if not draft.description.strip():
        raise ValidationError({"description": "A description is required before publishing."})
    if not draft.details_description.strip():
        raise ValidationError(
            {"details_description": "Full product details are required before publishing."}
        )

    price = draft.price if draft.price is not None else draft.suggested_price
    if not price or price <= 0:
        raise ValidationError({"price": "Set a selling price before publishing."})
    if draft.store.user_id != vendor.id:
        raise ValidationError({"store": "This draft does not belong to your store."})

    product = Product.objects.create(
        title=draft.title,
        regular_price=price,
        stoc=draft.stock,
        out_of_stoc=draft.stock <= 0,
        discounted_parcent=max(0, min(draft.discount_percent, 100)),
        description=draft.description,
        modle=draft.modle or "AI listing",
        categories=draft.category,
        tag=draft.tag or "",
        vendor_stores=draft.store,
        details_description=draft.details_description,
    )

    if draft.image:
        ProductImage.objects.create(product=product, image=draft.image.name)
    elif draft.external_image_url:
        ProductImage.objects.create(product=product, image=draft.external_image_url)

    for gallery_image in (draft.ai_payload or {}).get("gallery_images", []) or []:
        if gallery_image:
            ProductImage.objects.create(product=product, image=gallery_image)

    draft.status = ProductDraft.STATUS_PUBLISHED
    draft.published_product = product
    draft.published_at = timezone.now()
    draft.save(
        update_fields=["status", "published_product", "published_at", "updated_at"]
    )
    return draft, product, True
