"""Small helpers shared by API serializers."""

from django.conf import settings


def build_media_url(request, value):
    """Return an absolute URL for a stored media value.

    ``ProductImage.image`` is a CharField that may already contain an external
    URL, while Django ``ImageField`` values are paths relative to MEDIA_ROOT.
    Both are normalised here so the React client never has to guess.
    """
    if not value:
        return None

    value = str(value)
    if value.startswith(("http://", "https://")):
        return value

    media_prefix = settings.MEDIA_URL.strip("/")
    path = value.lstrip("/")
    if not path.startswith(f"{media_prefix}/"):
        path = f"{media_prefix}/{path}"

    relative = f"/{path}"
    return request.build_absolute_uri(relative) if request is not None else relative


def absolute_image_url(request, image_field):
    """Absolute URL for a Django ImageField/FieldFile value."""
    if not image_field:
        return None
    return build_media_url(request, image_field.name)
