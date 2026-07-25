from datetime import date, timedelta

from fastapi.testclient import TestClient

from conftest import valid_ocr


def test_matching_receipt_is_matched(client: TestClient, claim: dict):
    response = client.post(
        f"/api/claims/{claim['id']}/mock-ocr", json=valid_ocr()
    )

    assert response.status_code == 200
    assert response.json()["final_result"] == "MATCHED"
    assert response.json()["status"] == "VERIFIED"
    assert "카드사 실제 승인 원장" in response.json()["disclaimer"]


def test_card_mismatch_requests_additional_proof(
    client: TestClient, claim: dict
):
    response = client.post(
        f"/api/claims/{claim['id']}/mock-ocr",
        json=valid_ocr(card_last4="1111"),
    )

    assert response.json()["final_result"] == "REVIEW_REQUIRED"
    assert response.json()["status"] == "ADDITIONAL_PROOF_REQUIRED"
    assert "CARD_LAST4_MISMATCH" in response.json()["anomaly_reasons"]


def test_missing_approval_number_requests_proof(
    client: TestClient, claim: dict
):
    response = client.post(
        f"/api/claims/{claim['id']}/mock-ocr",
        json=valid_ocr(approval_number=None),
    )

    assert response.json()["checks"]["approval_number_valid"] is False
    assert "MISSING_APPROVAL_NUMBER" in response.json()["anomaly_reasons"]


def test_low_ocr_confidence_requests_proof(
    client: TestClient, claim: dict
):
    response = client.post(
        f"/api/claims/{claim['id']}/mock-ocr",
        json=valid_ocr(confidence_score=0.79),
    )

    assert response.json()["checks"]["ocr_confidence_valid"] is False
    assert response.json()["status"] == "ADDITIONAL_PROOF_REQUIRED"


def test_duplicate_approval_number_is_detected(
    client: TestClient, registered_card: dict, claim: dict
):
    first = client.post(
        f"/api/claims/{claim['id']}/mock-ocr",
        json=valid_ocr(approval_number="DUP-1234"),
    )
    assert first.json()["final_result"] == "MATCHED"
    second_claim = client.post(
        "/api/claims",
        json={
            "user_id": 1,
            "student_id": 11,
            "registered_card_id": registered_card["id"],
        },
    ).json()

    second = client.post(
        f"/api/claims/{second_claim['id']}/mock-ocr",
        json=valid_ocr(approval_number="DUP 1234"),
    )

    assert second.json()["checks"]["duplicate_transaction_detected"] is True
    assert "DUPLICATE_APPROVAL_NUMBER" in second.json()["anomaly_reasons"]


def test_future_payment_date_requires_review(client: TestClient, claim: dict):
    future = (date.today() + timedelta(days=1)).isoformat()

    response = client.post(
        f"/api/claims/{claim['id']}/mock-ocr",
        json=valid_ocr(payment_date=future),
    )

    assert response.json()["checks"]["payment_date_valid"] is False
    assert "FUTURE_PAYMENT_DATE" in response.json()["anomaly_reasons"]
