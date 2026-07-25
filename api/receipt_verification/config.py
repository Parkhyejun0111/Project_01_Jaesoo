from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class ReceiptSettings:
    environment: str
    database_url: str | None
    sqlite_path: Path
    upload_dir: Path
    ocr_provider: str
    ocr_confidence_threshold: float
    max_upload_size_mb: int
    max_payment_age_days: int
    mock_ocr_endpoint_enabled: bool

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @classmethod
    def from_env(cls) -> "ReceiptSettings":
        environment = os.getenv("APP_ENV", "development").strip().lower()
        sqlite_path = Path(
            os.getenv("RECEIPT_SQLITE_PATH", ".data/receipt_verification.db")
        ).resolve()
        upload_dir = Path(os.getenv("RECEIPT_UPLOAD_DIR", "uploads")).resolve()
        default_mock_enabled = environment in {"development", "local", "test"}
        return cls(
            environment=environment,
            database_url=os.getenv("RECEIPT_DATABASE_URL") or None,
            sqlite_path=sqlite_path,
            upload_dir=upload_dir,
            ocr_provider=os.getenv("OCR_PROVIDER", "mock").strip().lower(),
            ocr_confidence_threshold=float(
                os.getenv("OCR_CONFIDENCE_THRESHOLD", "0.80")
            ),
            max_upload_size_mb=int(os.getenv("MAX_UPLOAD_SIZE_MB", "10")),
            max_payment_age_days=int(os.getenv("MAX_PAYMENT_AGE_DAYS", "365")),
            mock_ocr_endpoint_enabled=_as_bool(
                os.getenv("ENABLE_MOCK_OCR_ENDPOINT"), default_mock_enabled
            ),
        )
