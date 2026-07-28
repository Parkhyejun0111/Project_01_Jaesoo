from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Callable
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from .config import ReceiptSettings
from .db import Database
from .enums import ClaimStatus, DocumentType, FinalResult
from .repositories import (
    CardRepository,
    ClaimRepository,
    DocumentRepository,
    OCRRepository,
    VerificationRepository,
)
from .schemas import (
    CardCreate,
    CardResponse,
    CardUpdate,
    ClaimCreate,
    ClaimDetailResponse,
    ClaimResponse,
    DocumentResponse,
    ErrorResponse,
    MockOCRRequest,
    OCRResultResponse,
    UploadProcessResponse,
    VerificationChecks,
    VerificationResponse,
)
from .services import (
    AnomalyDetectionService,
    CardService,
    ClaimService,
    DocumentService,
    OCRService,
    VerificationService,
)
from .services.errors import ReceiptVerificationError
from .services.ocr import (
    ClovaOCRProvider,
    ExternalOCRProvider,
    MockOCRProvider,
    OCRProvider,
)

_ERROR_RESPONSES = {
    400: {"model": ErrorResponse, "description": "잘못된 요청 또는 파일"},
    404: {"model": ErrorResponse, "description": "리소스를 찾을 수 없음"},
    409: {"model": ErrorResponse, "description": "현재 상태와 요청이 충돌함"},
    413: {"model": ErrorResponse, "description": "업로드 크기 제한 초과"},
    503: {"model": ErrorResponse, "description": "OCR 공급자를 사용할 수 없음"},
}


@dataclass(slots=True)
class ServiceContainer:
    cards: CardService
    claims: ClaimService
    documents: DocumentService
    ocr: OCRService
    verification: VerificationService


def _database_for_settings(settings: ReceiptSettings) -> Database:
    postgres_connect: Callable[[], Any] | None = None
    effective_settings = settings
    if settings.database_url:
        parsed = urlparse(settings.database_url)
        if parsed.scheme.startswith("sqlite"):
            raw_path = unquote(parsed.path)
            if parsed.netloc:
                raw_path = f"//{parsed.netloc}{raw_path}"
            if raw_path in {"", "/:memory:"}:
                raise ValueError("파일 기반 SQLite 경로를 설정해야 합니다.")
            if raw_path.startswith("/") and len(raw_path) >= 3 and raw_path[2] == ":":
                raw_path = raw_path[1:]
            effective_settings = replace(
                settings, sqlite_path=Path(raw_path).resolve()
            )
        elif parsed.scheme in {"postgres", "postgresql"}:
            import psycopg

            postgres_connect = lambda: psycopg.connect(settings.database_url)
        else:
            raise ValueError("RECEIPT_DATABASE_URL 스킴을 지원하지 않습니다.")
    else:
        try:
            import db_supabase

            if db_supabase.enabled():
                postgres_connect = db_supabase.connect
        except (ImportError, AttributeError):
            postgres_connect = None
    return Database(effective_settings, postgres_connect)


def build_container(settings: ReceiptSettings) -> ServiceContainer:
    database = _database_for_settings(settings)
    card_repository = CardRepository(database)
    claim_repository = ClaimRepository(database)
    document_repository = DocumentRepository(database)
    ocr_repository = OCRRepository(database)
    verification_repository = VerificationRepository(database)
    if settings.ocr_provider == "mock":
        provider: OCRProvider = MockOCRProvider()
    elif settings.ocr_provider == "clova":
        provider = ClovaOCRProvider()
    else:
        provider = ExternalOCRProvider()
    anomaly_service = AnomalyDetectionService(settings)
    return ServiceContainer(
        cards=CardService(card_repository),
        claims=ClaimService(claim_repository, card_repository),
        documents=DocumentService(document_repository, settings),
        ocr=OCRService(ocr_repository, provider),
        verification=VerificationService(
            claim_repository,
            card_repository,
            document_repository,
            ocr_repository,
            verification_repository,
            anomaly_service,
        ),
    )


def _raise_http(exc: ReceiptVerificationError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


def _verification_response(
    claim: dict[str, Any], verification: dict[str, Any]
) -> VerificationResponse:
    checks = VerificationChecks(
        card_last4_match=bool(verification["card_last4_match"]),
        payment_amount_valid=bool(verification["payment_amount_valid"]),
        payment_date_valid=bool(verification["payment_date_valid"]),
        approval_number_valid=bool(verification["approval_number_valid"]),
        merchant_name_valid=bool(verification["merchant_name_valid"]),
        business_number_valid=bool(verification["business_number_valid"]),
        duplicate_transaction_detected=bool(
            verification["duplicate_transaction_detected"]
        ),
        ocr_confidence_valid=bool(verification["ocr_confidence_valid"]),
    )
    status_value = ClaimStatus(claim["status"])
    next_action = None
    if status_value == ClaimStatus.ADDITIONAL_PROOF_REQUIRED:
        next_action = "UPLOAD_CARD_STATEMENT"
    elif status_value in {
        ClaimStatus.ADDITIONAL_PROOF_UPLOADED,
        ClaimStatus.MANUAL_REVIEW,
    }:
        next_action = "WAIT_FOR_MANUAL_REVIEW"
    return VerificationResponse(
        claim_id=int(claim["id"]),
        status=status_value,
        final_result=FinalResult(verification["final_result"]),
        checks=checks,
        anomaly_reasons=verification["anomaly_reasons"],
        next_action=next_action,
    )


def create_receipt_router(
    settings: ReceiptSettings | None = None,
) -> APIRouter:
    settings = settings or ReceiptSettings.from_env()
    services = build_container(settings)
    router = APIRouter()

    @router.post(
        "/api/cards",
        response_model=CardResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Receipt verification - cards"],
        summary="보험 가입 카드 등록",
        description=(
            "카드사와 카드번호 뒤 4자리만 등록합니다. 전체 카드번호, 유효기간, "
            "CVC 입력은 허용하지 않으며 새 카드를 등록하면 같은 사용자의 기존 "
            "활성 카드는 비활성화됩니다."
        ),
        responses=_ERROR_RESPONSES,
    )
    def register_card(payload: CardCreate) -> dict:
        return services.cards.register(payload)

    @router.get(
        "/api/cards/users/{user_id}/active",
        response_model=CardResponse,
        tags=["Receipt verification - cards"],
        summary="사용자의 활성 등록 카드 조회",
        responses=_ERROR_RESPONSES,
    )
    def get_active_card(user_id: int) -> dict:
        try:
            return services.cards.get_active(user_id)
        except ReceiptVerificationError as exc:
            _raise_http(exc)

    @router.get(
        "/api/cards/users/{user_id}",
        tags=["Receipt verification - cards"],
        summary="사용자의 등록 카드 목록 조회",
        description=(
            "청구 1단계(등록 카드 확인) 화면이 고를 카드 목록입니다. 활성 카드가 "
            "먼저 오고 그다음 최근 갱신 순입니다. 카드가 없으면 빈 목록을 "
            "반환합니다(오류가 아닙니다)."
        ),
    )
    def list_user_cards(
        user_id: int, active_only: bool = False, limit: int = 20
    ) -> dict:
        rows = services.cards.list_for_user(
            user_id, active_only=active_only, limit=min(max(limit, 1), 50)
        )
        return {
            "cards": [CardResponse.model_validate(row).model_dump() for row in rows],
            "user_id": user_id,
        }

    @router.put(
        "/api/cards/{card_id}",
        response_model=CardResponse,
        tags=["Receipt verification - cards"],
        summary="등록 카드 변경",
        description=(
            "카드사, 뒤 4자리, 명의자 관계 및 활성 상태를 변경합니다. "
            "활성화 시 같은 사용자의 다른 활성 카드는 비활성화됩니다."
        ),
        responses=_ERROR_RESPONSES,
    )
    def update_card(card_id: int, payload: CardUpdate) -> dict:
        try:
            return services.cards.update(card_id, payload)
        except ReceiptVerificationError as exc:
            _raise_http(exc)

    @router.post(
        "/api/claims",
        response_model=ClaimResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Receipt verification - claims"],
        summary="보험금 청구 생성",
        description="등록 카드와 학생을 연결한 DRAFT 상태의 청구를 생성합니다.",
        responses=_ERROR_RESPONSES,
    )
    def create_claim(payload: ClaimCreate) -> dict:
        try:
            return services.claims.create(payload)
        except ReceiptVerificationError as exc:
            _raise_http(exc)

    @router.post(
        "/api/claims/{claim_id}/receipt",
        response_model=UploadProcessResponse,
        tags=["Receipt verification - claims"],
        summary="학원 카드 영수증 업로드 및 자동 검증",
        description=(
            "JPG/JPEG/PNG/PDF 영수증을 저장하고 OCR·정규화·등록 카드 대조를 "
            "실행합니다. 불일치, 누락, 낮은 신뢰도, 중복 또는 유효성 문제는 "
            "ADDITIONAL_PROOF_REQUIRED가 됩니다. MATCHED는 카드사 실제 승인 "
            "원장 조회 결과가 아닙니다."
        ),
        responses=_ERROR_RESPONSES,
    )
    async def upload_receipt(
        claim_id: int,
        file: UploadFile = File(description="학원 카드 영수증 이미지 또는 PDF"),
    ) -> UploadProcessResponse:
        try:
            services.claims.get(claim_id)
            document, locator = await services.documents.save(
                claim_id, file, DocumentType.ACADEMY_RECEIPT
            )
            services.claims.set_state(claim_id, ClaimStatus.RECEIPT_UPLOADED)
            ocr = services.ocr.process_file(claim_id, locator)
            services.claims.set_state(claim_id, ClaimStatus.OCR_COMPLETED)
            verification = services.verification.verify(claim_id)
            claim = services.claims.get(claim_id)
            return UploadProcessResponse(
                document=DocumentResponse.model_validate(document),
                ocr_result=OCRResultResponse.model_validate(ocr),
                verification=_verification_response(claim, verification),
                status=ClaimStatus(claim["status"]),
            )
        except ReceiptVerificationError as exc:
            _raise_http(exc)

    if settings.mock_ocr_endpoint_enabled:

        @router.post(
            "/api/claims/{claim_id}/mock-ocr",
            response_model=VerificationResponse,
            tags=["Receipt verification - development"],
            summary="Mock OCR 결과로 검증",
            description=(
                "개발·테스트 환경 전용입니다. 실제 파일이나 카드사 API 없이 "
                "정규화와 이상 거래 판정 흐름을 시험합니다."
            ),
            responses=_ERROR_RESPONSES,
        )
        def submit_mock_ocr(
            claim_id: int, payload: MockOCRRequest
        ) -> VerificationResponse:
            try:
                services.claims.get(claim_id)
                services.ocr.save_normalized(claim_id, payload.model_dump())
                services.claims.set_state(claim_id, ClaimStatus.OCR_COMPLETED)
                verification = services.verification.verify(claim_id)
                claim = services.claims.get(claim_id)
                return _verification_response(claim, verification)
            except ReceiptVerificationError as exc:
                _raise_http(exc)

    @router.get(
        "/api/claims/{claim_id}/verification",
        response_model=VerificationResponse,
        tags=["Receipt verification - claims"],
        summary="청구 검증 결과 조회",
        description=(
            "필드별 검증 결과, 이상 사유와 다음 행동을 반환합니다. MATCHED는 "
            "등록 정보와 영수증 정보의 일치이며 카드사 실제 승인 원장 확인이 아닙니다."
        ),
        responses=_ERROR_RESPONSES,
    )
    def get_verification(claim_id: int) -> VerificationResponse:
        try:
            claim = services.claims.get(claim_id)
            verification = services.verification.get_for_claim(claim_id)
            return _verification_response(claim, verification)
        except ReceiptVerificationError as exc:
            _raise_http(exc)

    @router.post(
        "/api/claims/{claim_id}/additional-proof",
        response_model=UploadProcessResponse,
        tags=["Receipt verification - claims"],
        summary="카드사 공식 이용내역 추가 제출",
        description=(
            "ADDITIONAL_PROOF_REQUIRED 상태에서만 카드사 이용내역을 제출할 수 "
            "있습니다. 파일은 CARD_STATEMENT로 저장되고 자동 원장 대조 없이 "
            "MANUAL_REVIEW로 전환됩니다."
        ),
        responses=_ERROR_RESPONSES,
    )
    async def upload_additional_proof(
        claim_id: int,
        file: UploadFile = File(description="카드사 공식 이용내역 이미지 또는 PDF"),
    ) -> UploadProcessResponse:
        try:
            claim = services.claims.get(claim_id)
            if claim["status"] != ClaimStatus.ADDITIONAL_PROOF_REQUIRED.value:
                raise HTTPException(
                    status_code=409,
                    detail="추가 증빙 요청 상태에서만 파일을 제출할 수 있습니다.",
                )
            document, _ = await services.documents.save(
                claim_id, file, DocumentType.CARD_STATEMENT
            )
            claim = services.claims.set_state(claim_id, ClaimStatus.MANUAL_REVIEW)
            try:
                ocr = services.ocr.get_for_claim(claim_id)
                verification = services.verification.get_for_claim(claim_id)
            except ReceiptVerificationError:
                ocr = None
                verification = None
            return UploadProcessResponse(
                document=DocumentResponse.model_validate(document),
                ocr_result=(
                    OCRResultResponse.model_validate(ocr) if ocr else None
                ),
                verification=(
                    _verification_response(claim, verification)
                    if verification
                    else None
                ),
                status=ClaimStatus(claim["status"]),
            )
        except ReceiptVerificationError as exc:
            _raise_http(exc)

    # 목록 라우트는 /api/claims/{claim_id} 보다 먼저 선언해야 한다 —
    # 뒤에 두면 "claims" 경로가 claim_id 로 잡히지 않지만, 순서를 명시해 두는 편이
    # 이후 경로가 추가돼도 안전하다.
    @router.get(
        "/api/claims",
        tags=["Receipt verification - claims"],
        summary="청구 목록 조회",
        description="학생(student_id) 또는 가입자(user_id) 기준 청구 목록을 최신순으로 반환합니다.",
    )
    def list_claims(
        student_id: str | None = None,
        user_id: int | None = None,
        limit: int = 50,
    ) -> dict:
        if student_id is None and user_id is None:
            raise HTTPException(
                status_code=422, detail="student_id 또는 user_id 중 하나는 필요합니다."
            )
        rows = services.claims.list_for(
            student_id=student_id, user_id=user_id, limit=min(max(limit, 1), 200)
        )
        return {
            "claims": [ClaimResponse.model_validate(row).model_dump() for row in rows],
            "student_id": student_id,
            "user_id": user_id,
        }

    @router.get(
        "/api/claims/{claim_id}",
        response_model=ClaimDetailResponse,
        tags=["Receipt verification - claims"],
        summary="청구 상세 조회",
        description=(
            "현재 상태, 등록 카드 뒤 4자리, 문서, OCR, 검증 결과와 추가 증빙 "
            "필요 여부를 반환합니다."
        ),
        responses=_ERROR_RESPONSES,
    )
    def get_claim_detail(claim_id: int) -> ClaimDetailResponse:
        try:
            claim = services.claims.get(claim_id)
            card = services.cards.get(int(claim["registered_card_id"]))
            documents = services.documents.list_for_claim(claim_id)
            ocr = services.ocr.get_for_claim(claim_id)
            try:
                verification_row = services.verification.get_for_claim(claim_id)
            except ReceiptVerificationError:
                verification_row = None
            verification = (
                _verification_response(claim, verification_row)
                if verification_row
                else None
            )
            return ClaimDetailResponse(
                claim=ClaimResponse.model_validate(claim),
                registered_card=CardResponse.model_validate(card),
                documents=[
                    DocumentResponse.model_validate(item) for item in documents
                ],
                ocr_result=(
                    OCRResultResponse.model_validate(ocr) if ocr else None
                ),
                verification=verification,
                additional_proof_required=(
                    claim["status"]
                    == ClaimStatus.ADDITIONAL_PROOF_REQUIRED.value
                ),
            )
        except ReceiptVerificationError as exc:
            _raise_http(exc)

    return router
