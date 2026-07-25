from __future__ import annotations

import sys
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from receipt_verification import ReceiptSettings, create_receipt_router


@pytest.fixture
def app_settings(tmp_path: Path) -> ReceiptSettings:
    return ReceiptSettings(
        environment="test",
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        sqlite_path=tmp_path / "unused.db",
        upload_dir=tmp_path / "uploads",
        ocr_provider="mock",
        ocr_confidence_threshold=0.8,
        max_upload_size_mb=1,
        max_payment_age_days=365,
        mock_ocr_endpoint_enabled=True,
    )


@pytest.fixture
def client(app_settings: ReceiptSettings):
    app = FastAPI()
    app.include_router(create_receipt_router(app_settings))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def card_payload() -> dict:
    return {
        "user_id": 1,
        "card_company": "신한카드",
        "card_last4": "4821",
        "card_holder_name": "김학부모",
        "relationship_to_student": "부",
    }


@pytest.fixture
def registered_card(client: TestClient, card_payload: dict) -> dict:
    response = client.post("/api/cards", json=card_payload)
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def claim(client: TestClient, registered_card: dict) -> dict:
    response = client.post(
        "/api/claims",
        json={
            "user_id": registered_card["user_id"],
            "student_id": 10,
            "registered_card_id": registered_card["id"],
        },
    )
    assert response.status_code == 201
    return response.json()


def valid_ocr(
    *,
    card_last4: str = "4821",
    approval_number: str | None = "12345678",
    confidence_score: float = 0.97,
    payment_date: str | None = None,
) -> dict:
    return {
        "card_last4": card_last4,
        "payment_amount": 15_000_000,
        "payment_date": payment_date or date.today().isoformat(),
        "approval_number": approval_number,
        "merchant_name": "OO기숙학원",
        "business_number": "1234567890",
        "confidence_score": confidence_score,
    }


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"test-receipt"
PDF_BYTES = b"%PDF-1.7\n% test statement"
