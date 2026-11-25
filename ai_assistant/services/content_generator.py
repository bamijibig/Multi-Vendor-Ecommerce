"""Generate a vendor listing draft from a short prompt.

External AI is optional. The deterministic fallback produces a usable draft
from the seller's own words and category data, so the workflow never blocks on
a missing key, a timeout, or a malformed model response.
"""

from __future__ import annotations

import html
import logging
import re
from typing import Any

import requests
from django.utils.html import strip_tags

from .provider import AIProviderError, get_provider

logger = logging.getLogger(__name__)

_MAX_TITLE = 300
_MAX_TAG = 255
_MAX_MODEL = 50

_STOP_WORDS = {
    "about",
    "also",
    "and",
    "are",
    "for",
    "from",
    "have",
    "into",
    "item",
    "listing",
    "need",
    "please",
    "product",
    "sell",
    "selling",
    "that",
    "the",
    "this",
    "want",
    "with",
    "would",
    "your",
}


def _clean_prompt(prompt: str) -> str:
    value = re.sub(r"\s+", " ", (prompt or "").strip())
    value = re.sub(
        r"^(?:i\s+(?:want|need|would like)\s+to\s+)?(?:sell|list|create a listing for)\s+",
        "",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"^my\s+", "", value, flags=re.IGNORECASE)
    return value.strip(" .,-") or "New product"


def _title_from_prompt(prompt: str, category_name: str, condition: str) -> str:
    value = _clean_prompt(prompt)
    first_sentence = re.split(r"[.!?]\s", value)[0].strip()
    title = first_sentence[:90].strip(" .,-")
    if not title:
        title = f"{condition.replace('_', ' ').title()} {category_name or 'product'}"
    return title[:1].upper() + title[1:] if title else "New product"


def _tags_from_prompt(prompt: str, category_name: str) -> str:
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9+'-]{2,}", prompt or "")
    tags: list[str] = []
    for word in words:
        clean = word.strip("-'").lower()
        if clean and clean not in _STOP_WORDS and clean not in tags:
            tags.append(clean)
        if len(tags) >= 7:
            break
    if category_name:
        category_tag = category_name.strip().lower()
        if category_tag not in tags:
            tags.insert(0, category_tag)
    return ", ".join(tags)[:_MAX_TAG]


def _model_hint(prompt: str, category_name: str) -> str:
    match = re.search(
        r"\b(?:model|modle)\s*[:=-]?\s*([A-Za-z0-9][A-Za-z0-9 .+/-]{0,30})",
        prompt or "",
        re.IGNORECASE,
    )
    if match:
        return match.group(1).strip(" .,-")[:_MAX_MODEL]
    return (category_name or "AI listing")[:_MAX_MODEL]


def _text(value: Any, fallback: str, max_length: int | None = None) -> str:
    if not isinstance(value, str) or not value.strip():
        value = fallback
    value = value.strip()
    return value[:max_length] if max_length else value


def _safe_html(value: str, fallback: str) -> str:
    """Render model text as escaped paragraphs before it reaches RichTextField."""
    plain = strip_tags(value or fallback)
    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(r"\n\s*\n|\r\n\s*\r\n", plain)
        if paragraph.strip()
    ]
    if not paragraphs:
        paragraphs = [fallback]
    return "".join(f"<p>{html.escape(paragraph)}</p>" for paragraph in paragraphs)


def _market_sentence(market: dict[str, Any] | None) -> str:
    market = market or {}
    scope = market.get("scope") or "the catalogue"
    if not market.get("sample_size"):
        return f"No comparable products are available in {scope} yet."
    return (
        f"Comparable products in {scope} range from "
        f"{market.get('market_min')} to {market.get('market_max')}, with a "
        f"median of {market.get('market_median')}."
    )


def _local_draft(
    *, prompt: str, category_name: str, condition: str, market: dict[str, Any] | None
) -> dict[str, Any]:
    title = _title_from_prompt(prompt, category_name, condition)
    clean_prompt = _clean_prompt(prompt)
    tags = _tags_from_prompt(prompt, category_name)
    model = _model_hint(prompt, category_name)

    condition_label = condition.replace("_", " ").title()
    category_label = category_name or "general"
    description = (
        f"<p>{html.escape(title)} is a {condition_label.lower()} "
        f"{html.escape(category_label)} listing from a verified marketplace vendor.</p>"
        f"<p>{html.escape(clean_prompt)}</p>"
    )
    details = (
        f"<p>Details supplied by the seller:</p>"
        f"<p>{html.escape(clean_prompt)}</p>"
        f"<ul>"
        f"<li><strong>Condition:</strong> {html.escape(condition_label)}</li>"
        f"<li><strong>Category:</strong> {html.escape(category_label)}</li>"
        f"<li><strong>Market note:</strong> {html.escape(_market_sentence(market))}</li>"
        f"</ul>"
        f"<p>Review the details and add any specifications before publishing.</p>"
    )
    return {
        "title": title[:_MAX_TITLE],
        "description": description,
        "details_description": details,
        "tag": tags,
        "modle": model,
    }


def generate_listing_content(
    *,
    prompt: str,
    category_name: str = "",
    condition: str = "new",
    market: dict[str, Any] | None = None,
    provider=None,
) -> dict[str, Any]:
    """Return listing fields plus provider/fallback metadata.

    The returned ``description`` and ``details_description`` are safe HTML
    strings suitable for the project's RichTextField columns.
    """
    local = _local_draft(
        prompt=prompt,
        category_name=category_name,
        condition=condition,
        market=market,
    )
    note = ""
    provider = provider if provider is not None else get_provider()
    if provider is not None:
        system_prompt = (
            "You write concise, factual marketplace listings. Return only a JSON "
            "object with string keys: title, description, details_description, "
            "tag, model. Do not invent certifications or measurements. Keep the "
            "title under 90 characters, use 3-8 comma-separated tags, and write "
            "plain descriptions that can be shown in a rich-text product page."
        )
        user_prompt = (
            f"Seller prompt: {prompt}\n"
            f"Category: {category_name or 'unspecified'}\n"
            f"Condition: {condition}\n"
            f"Market context: {_market_sentence(market)}\n"
            "Generate a draft. The vendor will review every field before publishing."
        )
        try:
            payload = provider.generate_json(
                system_prompt=system_prompt, user_prompt=user_prompt
            )
            title = _text(payload.get("title"), local["title"], _MAX_TITLE)
            description = _safe_html(
                payload.get("description", ""), local["description"]
            )
            details = _safe_html(
                payload.get("details_description", ""),
                local["details_description"],
            )
            tags = _text(payload.get("tag"), local["tag"], _MAX_TAG)
            model = _text(payload.get("model"), local["modle"], _MAX_MODEL)
            return {
                "title": title,
                "description": description,
                "details_description": details,
                "tag": tags,
                "modle": model,
                "provider_used": provider.name,
                "fallback_used": False,
                "note": "Generated by the configured AI provider.",
                "ai_payload": payload,
            }
        except (
            AIProviderError,
            requests.RequestException,
            TimeoutError,
            ValueError,
            KeyError,
            TypeError,
        ) as exc:
            logger.warning("AI listing generation fell back to local draft: %s", exc)
            note = (
                "The AI provider was unavailable or returned an invalid response; "
                "a local draft was prepared instead."
            )
        except Exception as exc:  # noqa: BLE001 - provider boundary must not break drafts
            logger.exception("Unexpected AI provider failure: %s", exc)
            note = (
                "The AI provider failed unexpectedly; a local draft was prepared "
                "instead."
            )

    return {
        **local,
        "provider_used": "fallback",
        "fallback_used": True,
        "note": note
        or "AI is not configured. A local draft was generated for vendor review.",
        "ai_payload": {},
    }
