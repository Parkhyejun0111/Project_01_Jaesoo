from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from ..normalizers import (
    normalize_approval_number,
    normalize_business_number,
    normalize_card_last4,
    normalize_merchant_name,
    normalize_payment_amount,
    normalize_payment_date,
)
from ..repositories import OCRRepository
from .errors import OCRUnavailableError


def redact_raw_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value)
    text = re.sub(
        r"(?<!\d)(?:\d[\s-]?){13,19}(?!\d)",
        "[REDACTED_CARD_NUMBER]",
        text,
    )
    text = re.sub(
        r"(?i)\b(CVC|CVV|카드\s*보안코드)\s*[:=]?\s*\d{3,4}\b",
        r"\1 [REDACTED]",
        text,
    )
    return text


class OCRProvider(Protocol):
    def extract_receipt(self, file_path: str) -> dict[str, Any]:
        """Extract receipt fields without making card-issuer approval claims."""


class MockOCRProvider:
    def extract_receipt(self, file_path: str) -> dict[str, Any]:
        return {
            "card_last4": None,
            "payment_amount": None,
            "payment_date": None,
            "approval_number": None,
            "merchant_name": None,
            "business_number": None,
            "raw_text": None,
            "confidence_score": 0.0,
        }


class ExternalOCRProvider:
    def extract_receipt(self, file_path: str) -> dict[str, Any]:
        raise OCRUnavailableError(
            "ExternalOCRProvider가 설정되지 않았습니다. 실제 OCR 연동을 구현해야 합니다."
        )


class OCRService:
    def __init__(self, repository: OCRRepository, provider: OCRProvider):
        self.repository = repository
        self.provider = provider

    def process_file(self, claim_id: int, file_path: Path) -> dict:
        return self.save_normalized(
            claim_id, self.provider.extract_receipt(str(file_path))
        )

    def save_normalized(self, claim_id: int, raw: dict[str, Any]) -> dict:
        payment_date = normalize_payment_date(raw.get("payment_date"))
        values = {
            "claim_id": claim_id,
            "card_last4": normalize_card_last4(raw.get("card_last4")),
            "payment_amount": normalize_payment_amount(raw.get("payment_amount")),
            "payment_date": payment_date.isoformat() if payment_date else None,
            "approval_number": normalize_approval_number(
                raw.get("approval_number")
            ),
            "merchant_name": normalize_merchant_name(raw.get("merchant_name")),
            "business_number": normalize_business_number(
                raw.get("business_number")
            ),
            "raw_text": redact_raw_text(raw.get("raw_text")),
            "confidence_score": float(raw.get("confidence_score") or 0),
            "created_at": datetime.now(UTC).isoformat(),
        }
        return self.repository.upsert(values)

    def get_for_claim(self, claim_id: int) -> dict | None:
        return self.repository.get_for_claim(claim_id)
