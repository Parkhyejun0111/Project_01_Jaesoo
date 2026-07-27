from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from ..config import ReceiptSettings
from ..enums import FinalResult


@dataclass(slots=True)
class AnomalyDecision:
    checks: dict[str, bool]
    final_result: FinalResult
    anomaly_reasons: list[str]


class AnomalyDetectionService:
    def __init__(self, settings: ReceiptSettings):
        self.settings = settings

    def evaluate(
        self,
        *,
        claim: dict[str, Any],
        card: dict[str, Any],
        ocr: dict[str, Any],
        duplicate_approval: bool,
        duplicate_file: bool,
    ) -> AnomalyDecision:
        reasons: list[str] = []
        card_last4 = ocr.get("card_last4")
        card_match = bool(card_last4 and card_last4 == card["card_last4"])
        if not card_last4:
            reasons.append("MISSING_CARD_LAST4")
        elif not card_match:
            reasons.append("CARD_LAST4_MISMATCH")

        amount = ocr.get("payment_amount")
        amount_valid = isinstance(amount, int) and amount > 0
        if amount is None:
            reasons.append("MISSING_PAYMENT_AMOUNT")
        elif not amount_valid:
            reasons.append("INVALID_PAYMENT_AMOUNT")

        payment_date = self._as_date(ocr.get("payment_date"))
        claim_date = self._as_date(claim.get("created_at")) or date.today()
        payment_date_valid = payment_date is not None
        if payment_date is None:
            reasons.append("MISSING_PAYMENT_DATE")
        elif payment_date > date.today():
            payment_date_valid = False
            reasons.append("FUTURE_PAYMENT_DATE")
        elif (claim_date - payment_date).days > self.settings.max_payment_age_days:
            payment_date_valid = False
            reasons.append("PAYMENT_TOO_OLD")

        approval_valid = bool(ocr.get("approval_number"))
        if not approval_valid:
            reasons.append("MISSING_APPROVAL_NUMBER")

        merchant_valid = bool(ocr.get("merchant_name"))
        if not merchant_valid:
            reasons.append("MISSING_MERCHANT_NAME")

        business_number = ocr.get("business_number")
        business_valid = business_number is None or (
            isinstance(business_number, str)
            and len(business_number) == 10
            and business_number.isdigit()
        )
        if not business_valid:
            reasons.append("INVALID_BUSINESS_NUMBER")

        confidence_valid = (
            float(ocr.get("confidence_score") or 0)
            >= self.settings.ocr_confidence_threshold
        )
        if not confidence_valid:
            reasons.append("LOW_OCR_CONFIDENCE")

        duplicate_detected = duplicate_approval or duplicate_file
        if duplicate_approval:
            reasons.append("DUPLICATE_APPROVAL_NUMBER")
        if duplicate_file:
            reasons.append("DUPLICATE_FILE_HASH")
        if not bool(card.get("is_active")):
            reasons.append("REGISTERED_CARD_INACTIVE")

        checks = {
            "card_last4_match": card_match,
            "payment_amount_valid": amount_valid,
            "payment_date_valid": payment_date_valid,
            "approval_number_valid": approval_valid,
            "merchant_name_valid": merchant_valid,
            "business_number_valid": business_valid,
            "duplicate_transaction_detected": duplicate_detected,
            "ocr_confidence_valid": confidence_valid,
        }
        final_result = (
            FinalResult.MATCHED if not reasons else FinalResult.REVIEW_REQUIRED
        )
        return AnomalyDecision(checks, final_result, reasons)

    @staticmethod
    def _as_date(value: Any) -> date | None:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
            except ValueError:
                return None
        return None
