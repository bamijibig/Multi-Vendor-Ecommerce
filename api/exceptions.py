"""Consistent JSON error envelope for every API response.

Successful responses keep their natural shape; failures look like::

    {"success": false, "error": {"status": 400, "message": "...", "details": {...}}}
"""

import logging

from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def _first_message(data):
    if isinstance(data, dict):
        for key, value in data.items():
            message = _first_message(value)
            if message:
                return f"{key}: {message}" if key != "detail" else message
    if isinstance(data, list) and data:
        return _first_message(data[0])
    if isinstance(data, str):
        return data
    return None


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    details = response.data
    message = _first_message(details) or "Request failed."
    if isinstance(exc, ValidationError):
        message = message or "Validation failed."

    response.data = {
        "success": False,
        "error": {
            "status": response.status_code,
            "code": exc.__class__.__name__,
            "message": message,
            "details": details,
        },
    }
    return response
