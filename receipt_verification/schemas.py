from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .enums import ClaimStatus, DocumentType, FinalResult


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CardCreate(StrictSchema):
    user_id: int = Field(description="보험 가입 사용자 ID")
    card_company: str = Field(min_length=1, max_length=50, description="카드사명")
    card_last4: str = Field(description="카드번호 뒤 숫자 4자리")
    card_holder_name: str = Field(min_length=1, max_length=100)
    relationship_to_student: str = Field(min_length=1, max_length=30)

    @field_validator("card_last4")
    @classmethod
    def validate_last4(cls, value: str) -> str:
        if len(value) != 4 or not value.isdigit():
            raise ValueError("card_last4 must contain exactly four digits")
        return value


class CardUpdate(StrictSchema):
    card_company: str | None = Field(default=None, min_length=1, max_length=50)
    card_last4: str | None = None
    card_holder_name: str | None = Field(default=None, min_length=1, max_length=100)
    relationship_to_student: str | None = Field(
        default=None, min_length=1, max_length=30
    )
    is_active: bool | None = None

    @field_validator("card_last4")
    @classmethod
    def validate_last4(cls, value: str | None) -> str | None:
        if value is not None and (len(value) != 4 or not value.isdigit()):
            raise ValueError("card_last4 must contain exactly four digits")
        return value


class CardResponse(StrictSchema):
    id: int
    user_id: int
    card_company: str
    card_last4: str
    card_holder_name: str
    relationship_to_student: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ClaimCreate(StrictSchema):
    user_id: int
    student_id: int | str
    registered_card_id: int


class ClaimResponse(StrictSchema):
    id: int
    user_id: int
    student_id: str
    registered_card_id: int
    status: ClaimStatus
    verification_result: FinalResult | None
    anomaly_reasons: list[str]
    created_at: datetime
    updated_at: datetime


class MockOCRRequest(StrictSchema):
    card_last4: str | None = None
    payment_amount: int | str | None = None
    payment_date: date | str | None = None
    approval_number: str | None = None
    merchant_name: str | None = None
    business_number: str | None = None
    raw_text: str | None = Field(default=None, repr=False)
    confidence_score: float = Field(ge=0, le=1)


class OCRResultResponse(StrictSchema):
    id: int
    claim_id: int
    card_last4: str | None
    payment_amount: int | None
    payment_date: date | None
    approval_number: str | None
    merchant_name: str | None
    business_number: str | None
    raw_text: str | None
    confidence_score: float
    created_at: datetime


class DocumentResponse(StrictSchema):
    id: int
    claim_id: int
    original_filename: str
    stored_filename: str
    content_type: str
    file_size: int
    file_hash: str
    document_type: DocumentType
    uploaded_at: datetime


class VerificationChecks(StrictSchema):
    card_last4_match: bool
    payment_amount_valid: bool
    payment_date_valid: bool
    approval_number_valid: bool
    merchant_name_valid: bool
    business_number_valid: bool
    duplicate_transaction_detected: bool
    ocr_confidence_valid: bool


class VerificationResponse(StrictSchema):
    claim_id: int
    status: ClaimStatus
    final_result: FinalResult
    checks: VerificationChecks
    anomaly_reasons: list[str]
    next_action: str | None
    disclaimer: str = (
        "MATCHED는 등록 카드 정보와 제출 영수증 정보의 일치를 뜻하며, "
        "카드사 실제 승인 원장 확인을 뜻하지 않습니다."
    )


class ClaimDetailResponse(StrictSchema):
    claim: ClaimResponse
    registered_card: CardResponse
    documents: list[DocumentResponse]
    ocr_result: OCRResultResponse | None
    verification: VerificationResponse | None
    additional_proof_required: bool


class UploadProcessResponse(StrictSchema):
    document: DocumentResponse
    ocr_result: OCRResultResponse | None
    verification: VerificationResponse | None
    status: ClaimStatus


class ErrorResponse(StrictSchema):
    detail: str | dict[str, Any]
