"""Listing image hook.

A configured image-capable provider is tried first. Every failure — missing
image model, timeout, bad payload — falls back to a locally rendered preview
saved under ``MEDIA_ROOT/ai-listings/`` so the review card always has an image.
"""

from __future__ import annotations

import logging
import textwrap
import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, ImageFont

from .provider import get_provider

logger = logging.getLogger(__name__)


def _font(size: int):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        try:
            return ImageFont.load_default(size=size)
        except TypeError:
            return ImageFont.load_default()


def _placeholder_png(title: str, category_name: str = "") -> bytes:
    width, height = 900, 600
    image = Image.new("RGB", (width, height), "#101a33")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, 10), fill="#f97316")
    draw.ellipse((width - 280, -110, width + 80, 250), fill="#1f2c4d")
    draw.ellipse((-120, height - 220, 230, height + 80), fill="#172544")

    draw.text((60, 58), "AI LISTING PREVIEW", fill="#f97316", font=_font(24))
    wrapped = textwrap.wrap(title or "New product", width=28)[:4]
    y = 145
    for line in wrapped:
        draw.text((60, y), line, fill="#ffffff", font=_font(42))
        y += 54
    if category_name:
        draw.text((60, y + 22), category_name.upper(), fill="#b8c2d9", font=_font(22))
    draw.text(
        (60, height - 70),
        "Review every field before publishing",
        fill="#96a4bf",
        font=_font(20),
    )

    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def generate_listing_image(draft, provider=None) -> bool:
    """Attach a generated or locally rendered image to ``draft``.

    Returns ``True`` when a file was saved. Any provider bytes are normalised
    through Pillow so the stored file is a valid PNG.
    """
    provider = provider if provider is not None else get_provider()
    content: bytes | None = None
    if provider is not None and getattr(provider, "supports_images", False):
        try:
            raw = provider.generate_image(
                prompt=(
                    f"Clean marketplace product photo for {draft.title}. "
                    f"Category: {draft.category.name if draft.category else 'general'}. "
                    f"Condition: {draft.condition}."
                )
            )
            if raw:
                with Image.open(BytesIO(raw)) as generated:
                    output = BytesIO()
                    generated.convert("RGB").save(output, format="PNG")
                    content = output.getvalue()
        except Exception as exc:  # noqa: BLE001 - image is best-effort
            logger.warning("AI image generation failed; using local preview: %s", exc)

    if not content:
        content = _placeholder_png(
            draft.title, draft.category.name if draft.category else ""
        )

    filename = f"ai-listing-{uuid.uuid4().hex[:12]}.png"
    draft.image.save(filename, ContentFile(content), save=True)
    return True
