from __future__ import annotations

from datetime import UTC, datetime

from ..repositories import CardRepository
from ..schemas import CardCreate, CardUpdate
from .errors import NotFoundError


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class CardService:
    def __init__(self, repository: CardRepository):
        self.repository = repository

    def register(self, payload: CardCreate) -> dict:
        timestamp = utc_now()
        return self.repository.create(
            {
                **payload.model_dump(),
                "created_at": timestamp,
                "updated_at": timestamp,
            }
        )

    def get_active(self, user_id: int) -> dict:
        card = self.repository.get_active_for_user(user_id)
        if card is None:
            raise NotFoundError("활성 등록 카드를 찾을 수 없습니다.")
        return card

    def get(self, card_id: int) -> dict:
        card = self.repository.get(card_id)
        if card is None:
            raise NotFoundError("등록 카드를 찾을 수 없습니다.")
        return card

    def update(self, card_id: int, payload: CardUpdate) -> dict:
        changes = payload.model_dump(exclude_none=True)
        card = self.repository.update(card_id, changes, utc_now())
        if card is None:
            raise NotFoundError("등록 카드를 찾을 수 없습니다.")
        return card
