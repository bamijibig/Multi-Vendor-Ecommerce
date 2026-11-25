"""Error-handling middleware for the decoupled API.

DRF handles expected exceptions; this middleware guarantees that *unexpected*
exceptions under ``/api/`` still return a JSON envelope instead of an HTML
debug page, which the React client can display safely.
"""

import logging

from django.http import JsonResponse

logger = logging.getLogger("api.errors")


class ApiExceptionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except Exception:  # noqa: BLE001 - top-level safety net
            if not request.path.startswith("/api/"):
                raise
            logger.exception("Unhandled API exception on %s %s", request.method, request.path)
            return JsonResponse(
                {
                    "success": False,
                    "error": {
                        "status": 500,
                        "code": "InternalServerError",
                        "message": "An unexpected server error occurred.",
                        "details": None,
                    },
                },
                status=500,
            )
