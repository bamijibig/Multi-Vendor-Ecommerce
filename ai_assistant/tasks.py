"""Optional Celery integration for bulk upload processing."""

try:  # Celery is optional in local development.
    from celery import shared_task
except Exception:  # pragma: no cover - depends on installed packages
    shared_task = None


if shared_task is not None:

    @shared_task
    def process_bulk_batch_task(batch_id: int) -> None:
        from .bulk_upload_service import process_bulk_batch

        process_bulk_batch(batch_id)

else:  # pragma: no cover - exercised only when Celery is absent
    process_bulk_batch_task = None
}