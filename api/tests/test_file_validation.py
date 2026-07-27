from fastapi.testclient import TestClient

from conftest import PDF_BYTES, PNG_BYTES, valid_ocr


def test_duplicate_file_hash_is_detected(
    client: TestClient, registered_card: dict, claim: dict
):
    first_upload = client.post(
        f"/api/claims/{claim['id']}/receipt",
        files={"file": ("receipt.png", PNG_BYTES, "image/png")},
    )
    assert first_upload.status_code == 200
    first_mock = client.post(
        f"/api/claims/{claim['id']}/mock-ocr",
        json=valid_ocr(approval_number="FILE-ONE"),
    )
    assert first_mock.status_code == 200
    second_claim = client.post(
        "/api/claims",
        json={
            "user_id": 1,
            "student_id": 12,
            "registered_card_id": registered_card["id"],
        },
    ).json()
    second_upload = client.post(
        f"/api/claims/{second_claim['id']}/receipt",
        files={"file": ("another.png", PNG_BYTES, "image/png")},
    )
    assert second_upload.status_code == 200

    second_mock = client.post(
        f"/api/claims/{second_claim['id']}/mock-ocr",
        json=valid_ocr(approval_number="FILE-TWO"),
    )

    assert second_mock.json()["checks"]["duplicate_transaction_detected"] is True
    assert "DUPLICATE_FILE_HASH" in second_mock.json()["anomaly_reasons"]


def test_rejects_disallowed_extension(client: TestClient, claim: dict):
    response = client.post(
        f"/api/claims/{claim['id']}/receipt",
        files={"file": ("receipt.txt", b"not an image", "text/plain")},
    )

    assert response.status_code == 400


def test_rejects_file_over_size_limit(client: TestClient, claim: dict):
    too_large = b"\x89PNG\r\n\x1a\n" + b"x" * (1024 * 1024)

    response = client.post(
        f"/api/claims/{claim['id']}/receipt",
        files={"file": ("large.png", too_large, "image/png")},
    )

    assert response.status_code == 413


def test_additional_proof_changes_status(client: TestClient, claim: dict):
    mismatch = client.post(
        f"/api/claims/{claim['id']}/mock-ocr",
        json=valid_ocr(card_last4="0000"),
    )
    assert mismatch.json()["status"] == "ADDITIONAL_PROOF_REQUIRED"

    response = client.post(
        f"/api/claims/{claim['id']}/additional-proof",
        files={"file": ("statement.pdf", PDF_BYTES, "application/pdf")},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "MANUAL_REVIEW"
    assert response.json()["document"]["document_type"] == "CARD_STATEMENT"
    detail = client.get(f"/api/claims/{claim['id']}").json()
    assert detail["claim"]["verification_result"] == "REVIEW_REQUIRED"
    assert "CARD_LAST4_MISMATCH" in detail["claim"]["anomaly_reasons"]
