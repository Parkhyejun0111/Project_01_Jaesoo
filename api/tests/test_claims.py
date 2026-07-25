import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from conftest import valid_ocr


def test_claim_detail_contains_linked_results(
    client: TestClient, claim: dict
):
    verification = client.post(
        f"/api/claims/{claim['id']}/mock-ocr", json=valid_ocr()
    )
    assert verification.status_code == 200

    detail = client.get(f"/api/claims/{claim['id']}")

    assert detail.status_code == 200
    assert detail.json()["claim"]["status"] == "VERIFIED"
    assert detail.json()["registered_card"]["card_last4"] == "4821"
    assert detail.json()["verification"]["final_result"] == "MATCHED"


def test_full_card_number_and_cvc_are_never_persisted_or_returned(
    client: TestClient,
    card_payload: dict,
    claim: dict,
    app_settings,
):
    forbidden = client.post(
        "/api/cards",
        json={
            **card_payload,
            "card_number": "4111111111114821",
            "cvc": "987",
        },
    )
    assert forbidden.status_code == 422

    response = client.post(
        f"/api/claims/{claim['id']}/mock-ocr",
        json={
            **valid_ocr(card_last4="4111-1111-1111-4821"),
            "raw_text": (
                "카드 4111-1111-1111-4821\n"
                "CVC: 987\n승인번호 12345678"
            ),
        },
    )
    assert response.status_code == 200
    detail = client.get(f"/api/claims/{claim['id']}").json()
    serialized = str(detail)
    assert "4111111111114821" not in serialized
    assert "4111-1111-1111-4821" not in serialized
    assert "CVC: 987" not in serialized
    assert detail["ocr_result"]["card_last4"] == "4821"
    assert "[REDACTED_CARD_NUMBER]" in detail["ocr_result"]["raw_text"]

    database_path = Path(app_settings.database_url.removeprefix("sqlite:///"))
    with sqlite3.connect(database_path) as connection:
        columns = {
            row[1]
            for table in (
                "registered_cards",
                "claims",
                "receipt_documents",
                "receipt_ocr_results",
                "verification_results",
            )
            for row in connection.execute(f"PRAGMA table_info({table})")
        }
        dump = "\n".join(connection.iterdump())
    assert "card_number" not in columns
    assert "cvc" not in columns
    assert "4111-1111-1111-4821" not in dump
    assert "CVC: 987" not in dump
