"""Bulk Excel upload processing for vendor products.

The processor is intentionally synchronous and transaction-safe enough for local
development. When Celery is configured, the view layer can call the same
function through a Celery task instead.
"""

from __future__ import annotations

import io
import logging
import re
import threading
import uuid
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone
from openpyxl import load_workbook

from products.models import Categories, Product
from Vendors.models import VendorStore

from ..models import BulkUploadBatch, ProductDraft
from .content_generator import generate_listing_content
from .image_service import generate_listing_image
from .pricing_analyzer import analyze_category_pricing
from .zip_image_matcher import extract_zip_images, normalize_sku

logger = logging.getLogger(__name__)

CONDITIONS = {choice[0] for choice in ProductDraft.CONDITION_CHOICES}
REQUIRED_COLUMNS = {"title", "category", "stock_quantity"}


def _as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _cell(row, index):
    if index is None or index >= len(row):
        return None
    value = row[index]
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _parse_int(value, field_name):
    if value is None or value == "":
        return None, f"{field_name} is required."
    try:
        number = int(float(value))
    except (TypeError, ValueError, InvalidOperation):
        return None, f"{field_name} must be a whole number."
    return number, None


def _parse_price(value):
    if value is None or value == "":
        return None, None
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None, "price must be a number."
    if number < 0:
        return None, "price cannot be negative."
    return int(number) if number == number.to_integral_value() else float(number), None


def _resolve_category(value):
    if value is None or value == "":
        return None, "category is required."
    if isinstance(value, int):
        category = Categories.objects.filter(pk=value).first()
        return (category, None) if category else (None, "category was not found.")
    text = str(value).strip()
    if text.isdigit():
        category = Categories.objects.filter(pk=int(text)).first()
        if category:
            return category, None
    category = Categories.objects.filter(name__iexact=text).first()
    if category:
        return category, None
    return None, f"category '{text}' was not found."


def _header_map(worksheet):
    headers = []
    for cell in worksheet[1]:
        value = cell.value
        headers.append(str(value).strip().lower() if value is not None else "")
    mapping = {}
    for index, header in enumerate(headers):
        if header:
            mapping[header] = index
    missing = REQUIRED_COLUMNS - set(mapping)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    return mapping


def _gallery_keys(zip_images, sku_norm):
    result = []
    for key, value in zip_images.items():
        if not sku_norm:
            continue
        if key == sku_norm:
            continue
        if key.startswith(f"{sku_norm}_") and key[len(sku_norm) + 1 :].isdigit():
            result.append((key, value))
    result.sort(key=lambda item: int(item[0].split("_")[-1]))
    return result


def _save_gallery_image(data, filename):
    suffix = Path(filename).suffix.lower() or ".png"
    safe_name = f"ai-listings/bulk-gallery-{uuid.uuid4().hex[:12]}{suffix}"
    return default_storage.save(safe_name, ContentFile(data))


def process_bulk_batch(batch_id: int) -> None:
    """Process one bulk upload batch into ``ProductDraft`` rows."""

    batch = BulkUploadBatch.objects.select_related("vendor", "store").get(pk=batch_id)
    batch.status = BulkUploadBatch.STATUS_PROCESSING
    batch.save(update_fields=["status", "updated_at"])

    errors = []
    processed = 0
    failed = 0
    seen_skus: set[str] = set()

    try:
        workbook = load_workbook(batch.excel_file.path, data_only=True)
        worksheet = workbook.active
        headers = _header_map(worksheet)
        rows = list(worksheet.iter_rows(min_row=2, values_only=True))

        non_empty_rows = [
            row for row in rows if any(cell not in (None, "") for cell in row)
        ]
        batch.total_rows = len(non_empty_rows)
        batch.save(update_fields=["total_rows", "updated_at"])

        zip_images = {}
        zip_warnings = []
        if batch.images_zip:
            try:
                zip_images, zip_warnings = extract_zip_images(batch.images_zip)
            except Exception as exc:  # noqa: BLE001 - report and continue without images
                errors.append(
                    {"row": 0, "errors": [str(exc)], "warnings": []}
                )
                zip_images = {}

        for zip_warning in zip_warnings:
            errors.append({"row": 0, "errors": [], "warnings": [zip_warning]})

        for row_number, row in enumerate(non_empty_rows, start=2):
            row_errors = []
            row_warnings = []

            title = _cell(row, headers.get("title"))
            category_value = _cell(row, headers.get("category"))
            stock_raw = _cell(row, headers.get("stock_quantity"))
            sku_raw = _cell(row, headers.get("sku"))
            condition_raw = _cell(row, headers.get("condition"))
            price_raw = _cell(row, headers.get("price"))
            description_raw = _cell(row, headers.get("description"))
            image_url_raw = _cell(row, headers.get("image_url"))

            title = str(title).strip() if title is not None else ""
            if not title:
                row_errors.append("title is required.")

            category, category_error = _resolve_category(category_value)
            if category_error:
                row_errors.append(category_error)

            stock, stock_error = _parse_int(stock_raw, "stock_quantity")
            if stock_error:
                row_errors.append(stock_error)
            elif stock is not None and stock < 0:
                row_errors.append("stock_quantity cannot be negative.")

            condition = str(condition_raw or "new").strip().lower().replace(" ", "_")
            if condition not in CONDITIONS:
                row_errors.append(
                    f"condition '{condition_raw}' is not valid."
                )
                condition = ProductDraft.CONDITION_NEW

            sku = str(sku_raw).strip() if sku_raw is not None else ""
            sku_norm = normalize_sku(sku)

            price, price_error = _parse_price(price_raw)
            if price_error:
                row_errors.append(price_error)

            if row_errors:
                failed += 1
                errors.append(
                    {
                        "row": row_number,
                        "sku": sku or None,
                        "errors": row_errors,
                        "warnings": row_warnings,
                    }
                )
                continue

            seen_skus.add(sku_norm) if sku_norm else None

            description = str(description_raw).strip() if description_raw else ""
            details_description = description
            tag = ""
            modle = sku or "Bulk listing"
            provider_used = "supplied"
            ai_note = "Supplied values were kept."
            suggested_price = None
            market_min = None
            market_max = None
            market_median = None
            market_sample_size = 0
            external_image_url = str(image_url_raw).strip() if image_url_raw else ""
            image_source = ""

            if description and not batch.auto_generate_description:
                description = description
            elif not description and batch.auto_generate_description:
                market = analyze_category_pricing(
                    category, condition=condition, currency="NGN"
                )
                content = generate_listing_content(
                    prompt=title,
                    category_name=category.name,
                    condition=condition,
                    market=market,
                )
                description = content["description"]
                details_description = content["details_description"]
                tag = content["tag"]
                modle = content["modle"] or modle
                provider_used = content["provider_used"]
                ai_note = content["note"]
            elif not description:
                ai_note = "No description was supplied or generated."
                row_warnings.append("description is empty.")
                provider_used = "none"

            if price is None and batch.auto_suggest_price:
                market = analyze_category_pricing(
                    category, condition=condition, currency="NGN"
                )
                suggested_price = market.get("suggested_price")
                market_min = market.get("market_min")
                market_max = market.get("market_max")
                market_median = market.get("market_median")
                market_sample_size = market.get("sample_size", 0)
                if price is None:
                    price = suggested_price
                if price is not None:
                    ai_note = f"{ai_note} Price suggested from category market data."
            elif price is not None:
                suggested_price = price

            if price is None:
                row_warnings.append("price is empty; set one before publishing.")

            zip_main = None
            zip_gallery = []
            if sku_norm and sku_norm in zip_images:
                zip_main = zip_images[sku_norm]
            elif sku_norm:
                gallery_only = _gallery_keys(zip_images, sku_norm)
                if gallery_only:
                    zip_main = None
                    zip_gallery = gallery_only
            if sku_norm:
                zip_gallery = _gallery_keys(zip_images, sku_norm)

            gallery_paths = []
            if zip_main is not None:
                filename, data = zip_main
                image_source = "zip"
            elif external_image_url:
                image_source = "excel_url"
            elif batch.auto_generate_image:
                image_source = "ai"
            else:
                image_source = "none"
                row_warnings.append("No image was supplied or generated.")

            draft = ProductDraft.objects.create(
                vendor=batch.vendor,
                store=batch.store,
                title=title,
                description=description or f"<p>{title}</p>",
                details_description=details_description or description or f"<p>{title}</p>",
                category=category,
                condition=condition,
                tag=tag,
                modle=modle,
                price=price,
                suggested_price=suggested_price,
                market_min=market_min,
                market_max=market_max,
                market_median=market_median,
                market_sample_size=market_sample_size,
                currency="NGN",
                stock=stock,
                discount_percent=0,
                prompt=f"Bulk upload row {row_number}",
                provider_used=provider_used,
                ai_note=ai_note,
                ai_payload={
                    "sku": sku,
                    "bulk_row": row_number,
                    "gallery_images": [],
                },
                image_source=image_source,
                external_image_url=external_image_url,
                sku=sku,
                bulk_batch=batch,
            )

            if zip_main is not None:
                filename, data = zip_main
                draft.image.save(filename, ContentFile(data), save=True)
                for key, (gallery_filename, gallery_data) in zip_gallery:
                    gallery_paths.append(
                        _save_gallery_image(gallery_data, gallery_filename)
                    )
                draft.ai_payload = {
                    **draft.ai_payload,
                    "gallery_images": gallery_paths,
                }
                draft.save(update_fields=["ai_payload", "updated_at"])

            if image_source == "ai":
                try:
                    generate_listing_image(draft)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Bulk AI image generation failed: %s", exc)
                    draft.image_source = "none"
                    draft.ai_note = f"{draft.ai_note} The preview image could not be generated."
                    draft.save(update_fields=["image_source", "ai_note", "updated_at"])
                    row_warnings.append("AI image generation failed.")

            if row_warnings:
                errors.append(
                    {
                        "row": row_number,
                        "sku": sku or None,
                        "errors": [],
                        "warnings": row_warnings,
                    }
                )

            processed += 1

        # Unmatched ZIP images.
        if zip_images:
            matched_stems = set()
            for row in non_empty_rows:
                sku_value = _cell(row, headers.get("sku"))
                sku_norm = normalize_sku(sku_value)
                if not sku_norm:
                    continue
                matched_stems.add(sku_norm)
                for key in zip_images:
                    if key.startswith(f"{sku_norm}_") and key[len(sku_norm) + 1 :].isdigit():
                        matched_stems.add(key)
            for stem in sorted(set(zip_images) - matched_stems):
                base_sku = re.sub(r"_\d+$", "", stem)
                if base_sku and base_sku in matched_stems:
                    continue
                errors.append(
                    {
                        "row": 0,
                        "sku": base_sku or stem,
                        "errors": [],
                        "warnings": [f"ZIP image '{stem}' did not match any Excel SKU."],
                    }
                )

        batch.processed_rows = processed
        batch.failed_rows = failed
        batch.error_report = errors
        batch.status = (
            BulkUploadBatch.STATUS_FAILED
            if processed == 0 and failed > 0
            else BulkUploadBatch.STATUS_READY
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Bulk upload processing failed: %s", exc)
        batch.status = BulkUploadBatch.STATUS_FAILED
        batch.error_report = [
            {"row": 0, "errors": [str(exc)], "warnings": []}
        ]
    finally:
        batch.save(
            update_fields=[
                "status",
                "total_rows",
                "processed_rows",
                "failed_rows",
                "error_report",
                "updated_at",
            ]
        )


def start_bulk_processing(batch: BulkUploadBatch) -> None:
    """Run processing synchronously or in a background thread/Celery."""

    celery_task = None
    try:
        from .tasks import process_bulk_batch_task

        celery_task = process_bulk_batch_task
    except Exception:  # noqa: BLE001
        celery_task = None

    broker = getattr(settings, "CELERY_BROKER_URL", None)
    if celery_task is not None and broker:
        celery_task.delay(batch.id)
        return

    if getattr(settings, "AI_BULK_ASYNC", False):
        thread = threading.Thread(
            target=process_bulk_batch, args=(batch.id,), daemon=True
        )
        thread.start()
        return

    process_bulk_batch(batch.id)