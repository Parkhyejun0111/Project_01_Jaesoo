from __future__ import annotations

import json
from typing import Any

from .db import Database, json_list


def _with_json_lists(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is not None and "anomaly_reasons" in row:
        row["anomaly_reasons"] = json_list(row["anomaly_reasons"])
    return row


class CardRepository:
    def __init__(self, database: Database):
        self.database = database

    def create(self, values: dict[str, Any]) -> dict[str, Any]:
        with self.database.transaction() as session:
            session.execute(
                "UPDATE registered_cards SET is_active = ?, updated_at = ? "
                "WHERE user_id = ? AND is_active = ?",
                (False, values["updated_at"], values["user_id"], True),
            )
            card_id = session.insert(
                "INSERT INTO registered_cards "
                "(user_id, card_company, card_last4, card_holder_name, "
                "relationship_to_student, is_active, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    values["user_id"],
                    values["card_company"],
                    values["card_last4"],
                    values["card_holder_name"],
                    values["relationship_to_student"],
                    True,
                    values["created_at"],
                    values["updated_at"],
                ),
            )
            row = session.fetch_one(
                "SELECT * FROM registered_cards WHERE id = ?", (card_id,)
            )
            assert row is not None
            return row

    def get(self, card_id: int) -> dict[str, Any] | None:
        return self.database.fetch_one(
            "SELECT * FROM registered_cards WHERE id = ?", (card_id,)
        )

    def get_active_for_user(self, user_id: int) -> dict[str, Any] | None:
        return self.database.fetch_one(
            "SELECT * FROM registered_cards "
            "WHERE user_id = ? AND is_active = ? ORDER BY updated_at DESC LIMIT 1",
            (user_id, True),
        )

    def update(
        self, card_id: int, changes: dict[str, Any], updated_at: str
    ) -> dict[str, Any] | None:
        allowed = {
            "card_company",
            "card_last4",
            "card_holder_name",
            "relationship_to_student",
            "is_active",
        }
        changes = {key: value for key, value in changes.items() if key in allowed}
        with self.database.transaction() as session:
            current = session.fetch_one(
                "SELECT * FROM registered_cards WHERE id = ?", (card_id,)
            )
            if current is None:
                return None
            if changes.get("is_active") is True:
                session.execute(
                    "UPDATE registered_cards SET is_active = ?, updated_at = ? "
                    "WHERE user_id = ? AND id <> ? AND is_active = ?",
                    (False, updated_at, current["user_id"], card_id, True),
                )
            if changes:
                assignments = ", ".join(f"{key} = ?" for key in changes)
                params = (*changes.values(), updated_at, card_id)
                session.execute(
                    f"UPDATE registered_cards SET {assignments}, updated_at = ? "
                    "WHERE id = ?",
                    params,
                )
            return session.fetch_one(
                "SELECT * FROM registered_cards WHERE id = ?", (card_id,)
            )


class ClaimRepository:
    def __init__(self, database: Database):
        self.database = database

    def create(self, values: dict[str, Any]) -> dict[str, Any]:
        claim_id = self.database.insert(
            "INSERT INTO claims "
            "(user_id, student_id, registered_card_id, status, "
            "verification_result, anomaly_reasons, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                values["user_id"],
                str(values["student_id"]),
                values["registered_card_id"],
                values["status"],
                None,
                "[]",
                values["created_at"],
                values["updated_at"],
            ),
        )
        row = self.get(claim_id)
        assert row is not None
        return row

    def get(self, claim_id: int) -> dict[str, Any] | None:
        return _with_json_lists(
            self.database.fetch_one("SELECT * FROM claims WHERE id = ?", (claim_id,))
        )

    def update_state(
        self,
        claim_id: int,
        *,
        status: str,
        updated_at: str,
        verification_result: str | None = None,
        anomaly_reasons: list[str] | None = None,
    ) -> dict[str, Any] | None:
        current = self.get(claim_id)
        if current is None:
            return None
        self.database.execute(
            "UPDATE claims SET status = ?, verification_result = ?, "
            "anomaly_reasons = ?, updated_at = ? WHERE id = ?",
            (
                status,
                (
                    verification_result
                    if verification_result is not None
                    else current["verification_result"]
                ),
                json.dumps(
                    (
                        anomaly_reasons
                        if anomaly_reasons is not None
                        else current["anomaly_reasons"]
                    ),
                    ensure_ascii=False,
                ),
                updated_at,
                claim_id,
            ),
        )
        return self.get(claim_id)


class DocumentRepository:
    def __init__(self, database: Database):
        self.database = database

    def create(self, values: dict[str, Any]) -> dict[str, Any]:
        document_id = self.database.insert(
            "INSERT INTO receipt_documents "
            "(claim_id, original_filename, stored_filename, content_type, "
            "file_size, file_hash, document_type, uploaded_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                values["claim_id"],
                values["original_filename"],
                values["stored_filename"],
                values["content_type"],
                values["file_size"],
                values["file_hash"],
                values["document_type"],
                values["uploaded_at"],
            ),
        )
        row = self.database.fetch_one(
            "SELECT * FROM receipt_documents WHERE id = ?", (document_id,)
        )
        assert row is not None
        return row

    def list_for_claim(self, claim_id: int) -> list[dict[str, Any]]:
        return self.database.fetch_all(
            "SELECT * FROM receipt_documents WHERE claim_id = ? "
            "ORDER BY uploaded_at, id",
            (claim_id,),
        )

    def academy_receipt_hash_exists_elsewhere(
        self, claim_id: int, file_hash: str
    ) -> bool:
        row = self.database.fetch_one(
            "SELECT id FROM receipt_documents "
            "WHERE file_hash = ? AND claim_id <> ? "
            "AND document_type = 'ACADEMY_RECEIPT' LIMIT 1",
            (file_hash, claim_id),
        )
        return row is not None


class OCRRepository:
    def __init__(self, database: Database):
        self.database = database

    def upsert(self, values: dict[str, Any]) -> dict[str, Any]:
        self.database.execute(
            "INSERT INTO receipt_ocr_results "
            "(claim_id, card_last4, payment_amount, payment_date, approval_number, "
            "merchant_name, business_number, raw_text, confidence_score, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(claim_id) DO UPDATE SET "
            "card_last4 = excluded.card_last4, "
            "payment_amount = excluded.payment_amount, "
            "payment_date = excluded.payment_date, "
            "approval_number = excluded.approval_number, "
            "merchant_name = excluded.merchant_name, "
            "business_number = excluded.business_number, "
            "raw_text = excluded.raw_text, "
            "confidence_score = excluded.confidence_score, "
            "created_at = excluded.created_at",
            (
                values["claim_id"],
                values["card_last4"],
                values["payment_amount"],
                values["payment_date"],
                values["approval_number"],
                values["merchant_name"],
                values["business_number"],
                values["raw_text"],
                values["confidence_score"],
                values["created_at"],
            ),
        )
        row = self.get_for_claim(values["claim_id"])
        assert row is not None
        return row

    def get_for_claim(self, claim_id: int) -> dict[str, Any] | None:
        return self.database.fetch_one(
            "SELECT * FROM receipt_ocr_results WHERE claim_id = ?", (claim_id,)
        )

    def approval_exists_elsewhere(
        self, claim_id: int, approval_number: str | None
    ) -> bool:
        if not approval_number:
            return False
        row = self.database.fetch_one(
            "SELECT id FROM receipt_ocr_results "
            "WHERE approval_number = ? AND claim_id <> ? LIMIT 1",
            (approval_number, claim_id),
        )
        return row is not None


class VerificationRepository:
    def __init__(self, database: Database):
        self.database = database

    def upsert(self, values: dict[str, Any]) -> dict[str, Any]:
        reasons = json.dumps(values["anomaly_reasons"], ensure_ascii=False)
        self.database.execute(
            "INSERT INTO verification_results "
            "(claim_id, card_last4_match, payment_amount_valid, payment_date_valid, "
            "approval_number_valid, merchant_name_valid, business_number_valid, "
            "duplicate_transaction_detected, ocr_confidence_valid, final_result, "
            "anomaly_reasons, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(claim_id) DO UPDATE SET "
            "card_last4_match = excluded.card_last4_match, "
            "payment_amount_valid = excluded.payment_amount_valid, "
            "payment_date_valid = excluded.payment_date_valid, "
            "approval_number_valid = excluded.approval_number_valid, "
            "merchant_name_valid = excluded.merchant_name_valid, "
            "business_number_valid = excluded.business_number_valid, "
            "duplicate_transaction_detected = excluded.duplicate_transaction_detected, "
            "ocr_confidence_valid = excluded.ocr_confidence_valid, "
            "final_result = excluded.final_result, "
            "anomaly_reasons = excluded.anomaly_reasons, "
            "created_at = excluded.created_at",
            (
                values["claim_id"],
                values["card_last4_match"],
                values["payment_amount_valid"],
                values["payment_date_valid"],
                values["approval_number_valid"],
                values["merchant_name_valid"],
                values["business_number_valid"],
                values["duplicate_transaction_detected"],
                values["ocr_confidence_valid"],
                values["final_result"],
                reasons,
                values["created_at"],
            ),
        )
        row = self.get_for_claim(values["claim_id"])
        assert row is not None
        return row

    def get_for_claim(self, claim_id: int) -> dict[str, Any] | None:
        return _with_json_lists(
            self.database.fetch_one(
                "SELECT * FROM verification_results WHERE claim_id = ?", (claim_id,)
            )
        )
