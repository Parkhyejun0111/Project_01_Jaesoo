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


def test_low_ocr_confidence_is_recorded_but_does_not_block(
    client: TestClient, claim: dict
):
    """글자가 흐린 것만으로는 추가 확인으로 보내지 않는다.

    신뢰도는 사용자가 손쓸 수 있는 값이 아니고, 정말 못 읽었다면 MISSING_* 검사가
    이미 잡는다. 예전에는 이것 하나로 멀쩡한 영수증이 계속 심사로 빠졌다.
    탐지 사실 자체는 checks 에 남겨 심사팀이 볼 수 있게 한다.
    """
    response = client.post(
        f"/api/claims/{claim['id']}/mock-ocr",
        json=valid_ocr(confidence_score=0.79),
    )
    body = response.json()

    assert body["checks"]["ocr_confidence_valid"] is False
    assert body["status"] == "VERIFIED"
    assert "LOW_OCR_CONFIDENCE" not in (body.get("anomaly_reasons") or [])


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
