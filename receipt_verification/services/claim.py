from __future__ import annotations

from datetime import UTC, datetime

from ..enums import ClaimStatus
from ..repositories import CardRepository, ClaimRepository
from ..schemas import ClaimCreate
from .errors import ConflictError, NotFoundError


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class ClaimService:
    def __init__(
        self, repository: ClaimRepository, card_repository: CardRepository
    ):
        self.repository = repository
        self.card_repository = card_repository

    def create(self, payload: ClaimCreate) -> dict:
        card = self.card_repository.get(payload.registered_card_id)
        if card is None:
            raise NotFoundError("등록 카드를 찾을 수 없습니다.")
        if int(card["user_id"]) != payload.user_id:
            raise ConflictError("청구 사용자와 등록 카드 사용자가 일치하지 않습니다.")
        timestamp = utc_now()
        return self.repository.create(
            {
                **payload.model_dump(),
                "status": ClaimStatus.DRAFT.value,
                "created_at": timestamp,
                "updated_at": timestamp,
            }
        )

    def get(self, claim_id: int) -> dict:
        claim = self.repository.get(claim_id)
        if claim is None:
            raise NotFoundError("청구를 찾을 수 없습니다.")
        return claim

    def set_state(
        self,
        claim_id: int,
        status: ClaimStatus,
        *,
        verification_result: str | None = None,
        anomaly_reasons: list[str] | None = None,
    ) -> dict:
        claim = self.repository.update_state(
            claim_id,
            status=status.value,
            updated_at=utc_now(),
            verification_result=verification_result,
            anomaly_reasons=anomaly_reasons,
        )
        if claim is None:
            raise NotFoundError("청구를 찾을 수 없습니다.")
        return claim
