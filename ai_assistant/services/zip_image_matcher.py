"""Safe ZIP image extraction and SKU matching for bulk uploads.

The matcher only accepts a small allow-list of image types, validates every
member with Pillow, and refuses path traversal, nested archives, and
suspiciously large/unbalanced members. It returns a mapping keyed by the
normalized filename stem so callers can look up both ``<sku>`` and
``<sku>_1`` / ``<sku>_2`` gallery images.
"""

from __future__ import annotations

import io
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

from PIL import Image

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_PIL_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_FILES = 1000
MAX_SINGLE_BYTES = 10 * 1024 * 1024
MAX_TOTAL_BYTES = 50 * 1024 * 1024
MAX_COMPRESSION_RATIO = 100


class ZipSecurityError(ValueError):
    """Raised when a ZIP archive violates the safety rules."""


def normalize_sku(value: Any) -> str:
    return str(value or "").strip().lower()


def _validate_member(info: zipfile.ZipInfo) -> None:
    if info.is_dir():
        return
    raw_name = str(info.filename or "").replace("\\", "/")
    if not raw_name or raw_name.endswith("/"):
        return
    path = PurePosixPath(raw_name)
    if path.is_absolute():
        raise ZipSecurityError(f"Unsafe ZIP member path: {info.filename!r}")
    if any(part in ("", ".", "..") for part in path.parts):
        raise ZipSecurityError(f"Unsafe ZIP member path: {info.filename!r}")
    if path.parts and path.parts[0] == "__MACOSX":
        return
    if path.name == ".DS_Store":
        return
    suffix = path.suffix.lower()
    if suffix == ".zip":
        raise ZipSecurityError(f"Nested ZIP archives are not allowed: {info.filename!r}")
    if suffix and suffix not in ALLOWED_EXTENSIONS:
        return


def extract_zip_images(zip_file) -> tuple[dict[str, tuple[str, bytes]], list[str]]:
    """Extract and validate images from *zip_file*.

    Returns ``(images, warnings)`` where *images* maps a normalized filename
    stem to ``(filename, image_bytes)``. Security violations raise
    :class:`ZipSecurityError`.
    """

    images: dict[str, tuple[str, bytes]] = {}
    warnings: list[str] = []

    try:
        archive = zipfile.ZipFile(zip_file)
    except zipfile.BadZipFile as exc:
        raise ZipSecurityError("The uploaded file is not a valid ZIP archive.") from exc

    with archive:
        infos = archive.infolist()
        if len(infos) > MAX_FILES:
            raise ZipSecurityError("ZIP archive contains too many members.")

        total_size = 0
        for info in infos:
            if info.is_dir():
                continue

            raw_name = str(info.filename or "").replace("\\", "/")
            path = PurePosixPath(raw_name)
            if path.parts and path.parts[0] == "__MACOSX":
                continue
            if path.name == ".DS_Store":
                continue

            _validate_member(info)

            suffix = path.suffix.lower()
            if suffix not in ALLOWED_EXTENSIONS:
                continue
            if info.file_size > MAX_SINGLE_BYTES:
                raise ZipSecurityError(
                    f"ZIP member is too large: {info.filename!r}"
                )
            if info.compress_size and info.file_size / max(info.compress_size, 1) > MAX_COMPRESSION_RATIO:
                raise ZipSecurityError(
                    f"ZIP member has suspicious compression ratio: {info.filename!r}"
                )

            total_size += info.file_size
            if total_size > MAX_TOTAL_BYTES:
                raise ZipSecurityError("ZIP archive is too large when extracted.")

            try:
                data = archive.read(info)
            except (OSError, RuntimeError, zipfile.error) as exc:
                warnings.append(f"Could not read {info.filename}: {exc}")
                continue

            try:
                with Image.open(io.BytesIO(data)) as image:
                    image.verify()
                    image_format = image.format
            except Exception:  # noqa: BLE001 - any invalid image is skipped
                warnings.append(f"Invalid or corrupt image skipped: {info.filename}")
                continue

            if image_format not in ALLOWED_PIL_FORMATS:
                warnings.append(f"Unsupported image format skipped: {info.filename}")
                continue

            stem = normalize_sku(path.stem)
            if not stem:
                continue
            if stem in images:
                warnings.append(f"Duplicate image for '{stem}' skipped: {info.filename}")
                continue
            images[stem] = (path.name, data)

    return images, warnings