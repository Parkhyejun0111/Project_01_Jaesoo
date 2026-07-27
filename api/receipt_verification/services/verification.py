from __future__ import annotations

from datetime import UTC, datetime

from ..enums import ClaimStatus, DocumentType, FinalResult
from ..repositories import (
    CardRepository,
    ClaimRepository,
    DocumentRepository,
    OCRRepository,
    VerificationRepository,
)
from .anomaly import AnomalyDetectionService
from .errors import NotFoundError


class VerificationService:
    def __init__(
        self,
        claim_repository: ClaimRepository,
        card_repository: CardRepository,
        document_repository: DocumentRepository,
        ocr_repository: OCRRepository,
        verification_repository: VerificationRepository,
        anomaly_service: AnomalyDetectionService,
    ):
        self.claim_repository = claim_repository
        self.card_repository = card_repository
        self.document_repository = document_repository
        self.ocr_repository = ocr_repository
        self.verification_repository = verification_repository
        self.anomaly_service = anomaly_service

    def verify(self, claim_id: int) -> dict:
        claim = self.claim_repository.get(claim_id)
        if claim is None:
            raise NotFoundError("청구를 찾을 수 없습니다.")
        card = self.card_repository.get(int(claim["registered_card_id"]))
        if card is None:
            raise NotFoundError("청구에 연결된 등록 카드를 찾을 수 없습니다.")
        ocr = self.ocr_repository.get_for_claim(claim_id)
        if ocr is None:
            raise NotFoundError("OCR 결과를 찾을 수 없습니다.")

        duplicate_approval = self.ocr_repository.approval_exists_elsewhere(
            claim_id, ocr.get("approval_number")
        )
        receipt_documents = [
            document
            for document in self.document_repository.list_for_claim(claim_id)
            if document["document_type"] == DocumentType.ACADEMY_RECEIPT.value
        ]
        duplicate_file = any(
            self.document_repository.academy_receipt_hash_exists_elsewhere(
                claim_id, document["file_hash"]
            )
            for document in receipt_documents
        )
        decision = self.anomaly_service.evaluate(
            claim=claim,
            card=card,
            ocr=ocr,
            duplicate_approval=duplicate_approval,
            duplicate_file=duplicate_file,
        )
        values = {
            "claim_id": claim_id,
            **decision.checks,
            "final_result": decision.final_result.value,
            "anomaly_reasons": decision.anomaly_reasons,
            "created_at": datetime.now(UTC).isoformat(),
        }
        verification = self.verification_repository.upsert(values)
        status = (
            ClaimStatus.VERIFIED
            if decision.final_result == FinalResult.MATCHED
            else ClaimStatus.ADDITIONAL_PROOF_REQUIRED
        )
        self.claim_repository.update_state(
            claim_id,
            status=status.value,
            updated_at=datetime.now(UTC).isoformat(),
            verification_result=decision.final_result.value,
            anomaly_reasons=decision.anomaly_reasons,
        )
        return verification

    def get_for_claim(self, claim_id: int) -> dict:
        verification = self.verification_repository.get_for_claim(claim_id)
        if verification is None:
            raise NotFoundError("검증 결과를 찾을 수 없습니다.")
        return verification
