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


# 자동 통과를 막는 사유 — 지급 자체가 불가능하거나 부정 신호인 것만 넣는다.
#   · 카드 불일치      다른 사람 카드로 결제된 영수증
#   · 금액 없음/이상   지급액을 정할 수 없다
#   · 미래·기간초과일  청구 요건을 벗어난다
#   · 중복             같은 결제로 두 번 받으려는 시도
#   · 정지 카드        결제수단이 유효하지 않다
# 나머지는 사유로 기록만 하고 통과시킨다(상호·승인번호를 못 읽은 정도).
BLOCKING_REASONS = frozenset({
    "CARD_LAST4_MISMATCH",
    "MISSING_PAYMENT_AMOUNT",
    "INVALID_PAYMENT_AMOUNT",
    "FUTURE_PAYMENT_DATE",
    "PAYMENT_TOO_OLD",
    "DUPLICATE_APPROVAL_NUMBER",
    "DUPLICATE_FILE_HASH",
    "REGISTERED_CARD_INACTIVE",
})


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

        # 인식 신뢰도는 기록만 하고 사유로 올리지 않는다.
        # 글자가 조금 흐린 건 그 자체로 문제가 아니고, 정말 못 읽었으면 위쪽의
        # MISSING_* 검사가 이미 잡는다. 예전에는 이것 때문에 멀쩡한 영수증이
        # 계속 '추가 확인'으로 빠졌다.
        confidence_valid = (
            float(ocr.get("confidence_score") or 0)
            >= self.settings.ocr_confidence_threshold
        )

        # 시연 모드에서는 중복을 사유로 올리지 않는다. 여러 사람이 같은 영수증
        # 샘플로 청구를 돌려봐야 해서다. checks 에는 탐지 사실을 그대로 남겨
        # 심사 화면·통계에서는 여전히 보이게 한다.
        if self.settings.allow_duplicate_receipts:
            duplicate_approval = duplicate_file = False
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
        # 사람이 다시 봐야 하는 건 '지급을 막는 문제'나 '부정 신호'뿐이다.
        # 나머지(승인번호·상호를 못 읽음, 사업자번호 형식 등)는 사유로 남겨
        # 화면에 보여주되 자동 통과를 막지는 않는다 — 심사팀이 서류로 확인한다.
        blocking = [code for code in reasons if code in BLOCKING_REASONS]
        final_result = (
            FinalResult.MATCHED if not blocking else FinalResult.REVIEW_REQUIRED
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
