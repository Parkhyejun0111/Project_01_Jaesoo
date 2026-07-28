from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from ..normalizers import (
    normalize_approval_number,
    normalize_business_number,
    normalize_card_last4,
    normalize_merchant_name,
    normalize_payment_amount,
    normalize_payment_date,
)
from ..repositories import OCRRepository
from .errors import OCRUnavailableError


def redact_raw_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value)
    text = re.sub(
        r"(?<!\d)(?:\d[\s-]?){13,19}(?!\d)",
        "[REDACTED_CARD_NUMBER]",
        text,
    )
    text = re.sub(
        r"(?i)\b(CVC|CVV|카드\s*보안코드)\s*[:=]?\s*\d{3,4}\b",
        r"\1 [REDACTED]",
        text,
    )
    return text


class OCRProvider(Protocol):
    def extract_receipt(
        self, file_path: str, data: bytes | None = None
    ) -> dict[str, Any]:
        """Extract receipt fields without making card-issuer approval claims."""


class MockOCRProvider:
    def extract_receipt(
        self, file_path: str, data: bytes | None = None
    ) -> dict[str, Any]:
        return {
            "card_last4": None,
            "payment_amount": None,
            "payment_date": None,
            "approval_number": None,
            "merchant_name": None,
            "business_number": None,
            "raw_text": None,
            "confidence_score": 0.0,
        }


class ExternalOCRProvider:
    def extract_receipt(
        self, file_path: str, data: bytes | None = None
    ) -> dict[str, Any]:
        raise OCRUnavailableError(
            "ExternalOCRProvider가 설정되지 않았습니다. 실제 OCR 연동을 구현해야 합니다."
        )


# ── CLOVA OCR (네이버 클라우드) ────────────────────────────────────────────
#   일반(General) 도메인은 글자만 뽑아준다 — 영수증 필드로 구조화하는 건 여기서 한다.
#   특화 모델(영수증)을 쓰면 storeInfo/paymentInfo 가 그대로 오지만, 지금 발급된
#   도메인은 일반이라 텍스트를 정규식으로 읽는다.

_CARD_TAIL = re.compile(r"(?:\d[\s-]*){8,}?(\d{4})\s*$")
_AMOUNT = re.compile(r"([0-9][0-9,\.]{2,})\s*원?")
_APPROVAL = re.compile(r"(?:승인\s*번호|approval)\D{0,6}(\d{6,12})", re.I)
_BIZNUM = re.compile(r"(\d{3}-\d{2}-\d{5})")
_DATE = re.compile(r"(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})")
# 금액 앞에 붙는 말 — '합계 15,000,000' 처럼 총액을 가리키는 줄을 우선한다.
_TOTAL_HINT = re.compile(r"합\s*계|총\s*액|결제\s*금액|승인\s*금액|total", re.I)
# 라벨 사이에 OCR 잡음이 끼기도 한다 — '상& 호 : 메가스터디' 처럼 읽힌 적이 있다.
_MERCHANT_HINT = re.compile(r"상\s*[&·.,]?\s*호|가\s*맹\s*점|사업자\s*명|업\s*소\s*명")


class ClovaOCRProvider:
    """네이버 CLOVA OCR 연동.

    환경변수
      CLOVA_OCR_INVOKE_URL   도메인별 엔드포인트
      CLOVA_OCR_SECRET_KEY   X-OCR-SECRET 헤더 값
      CLOVA_OCR_TIMEOUT_SEC  기본 20초

    실패하면 OCRUnavailableError 를 올린다 — 호출부가 이를 '확인 실패'로 처리해
    카드사 이용내역 제출 단계로 넘긴다. OCR 장애가 청구 자체를 막지는 않는다.
    """

    def __init__(
        self,
        invoke_url: str | None = None,
        secret_key: str | None = None,
        timeout: float | None = None,
    ) -> None:
        import os

        # None 일 때만 환경변수를 본다. 빈 문자열을 넘기면 '설정 안 함'으로 취급해야
        # 테스트에서 미설정 상황을 만들 수 있다 (or 로 묶으면 ""가 환경변수로 새어든다).
        if invoke_url is None:
            invoke_url = os.getenv("CLOVA_OCR_INVOKE_URL", "")
        if secret_key is None:
            secret_key = os.getenv("CLOVA_OCR_SECRET_KEY", "")
        self.invoke_url = invoke_url.strip()
        self.secret_key = secret_key.strip()
        self.timeout = timeout or float(os.getenv("CLOVA_OCR_TIMEOUT_SEC", "20"))

    def extract_receipt(
        self, file_path: str, data: bytes | None = None
    ) -> dict[str, Any]:
        """data 를 주면 그 바이트를 쓴다.

        업로드 파일은 로컬 디스크가 아니라 Supabase·Vercel Blob 에 있을 수 있다.
        그 경우 file_path 는 객체 키라서 열리지 않으므로, 저장소가 읽어 온
        바이트를 그대로 받는다. file_path 는 확장자 판별에만 쓴다.
        """
        if not self.invoke_url or not self.secret_key:
            raise OCRUnavailableError(
                "CLOVA_OCR_INVOKE_URL / CLOVA_OCR_SECRET_KEY 가 설정되지 않았습니다."
            )

        import base64
        import json
        import uuid

        import httpx

        path = Path(file_path)
        if data is None:
            try:
                data = path.read_bytes()
            except OSError as exc:
                raise OCRUnavailableError(
                    f"영수증 파일을 읽지 못했습니다: {exc}"
                ) from exc
        blob = data

        suffix = path.suffix.lower().lstrip(".") or "jpg"
        fmt = {"jpeg": "jpg"}.get(suffix, suffix)

        payload = {
            "version": "V2",
            "requestId": str(uuid.uuid4()),
            "timestamp": 0,
            "lang": "ko",
            "images": [
                {
                    "format": fmt,
                    "name": "receipt",
                    "data": base64.b64encode(blob).decode("ascii"),
                }
            ],
        }

        try:
            response = httpx.post(
                self.invoke_url,
                headers={
                    "X-OCR-SECRET": self.secret_key,
                    "Content-Type": "application/json",
                },
                content=json.dumps(payload),
                timeout=self.timeout,
            )
        except httpx.HTTPError as exc:
            raise OCRUnavailableError(f"CLOVA OCR 호출 실패: {exc}") from exc

        if response.status_code != 200:
            raise OCRUnavailableError(
                f"CLOVA OCR 응답 오류 (HTTP {response.status_code}): "
                f"{response.text[:200]}"
            )

        return self.parse(response.json())

    @staticmethod
    def parse(body: dict[str, Any]) -> dict[str, Any]:
        """일반 도메인 응답(fields[])을 영수증 필드로 옮긴다.

        fields 는 읽기 순서대로 오고 lineBreak 로 줄이 끊긴다. 줄 단위로 다시
        묶어야 '승인번호 12345678' 처럼 라벨과 값이 떨어진 것을 잡을 수 있다.
        """
        images = body.get("images") or []
        if not images:
            raise OCRUnavailableError("CLOVA OCR 응답에 images 가 없습니다.")

        image = images[0]
        if image.get("inferResult") != "SUCCESS":
            raise OCRUnavailableError(
                f"CLOVA OCR 인식 실패: {image.get('message') or image.get('inferResult')}"
            )

        lines: list[str] = []
        current: list[str] = []
        confidences: list[float] = []
        for field in image.get("fields") or []:
            text = str(field.get("inferText") or "").strip()
            if text:
                current.append(text)
            try:
                confidences.append(float(field.get("inferConfidence") or 0))
            except (TypeError, ValueError):
                pass
            if field.get("lineBreak"):
                if current:
                    lines.append(" ".join(current))
                current = []
        if current:
            lines.append(" ".join(current))

        raw_text = "\n".join(lines)
        # 평균이 아니라 최저값을 쓴다 — 한 글자만 흐려도 승인번호가 통째로 틀어진다.
        confidence = min(confidences) if confidences else 0.0

        return {
            "card_last4": _find_card_last4(lines),
            "payment_amount": _find_amount(lines),
            "payment_date": _find_date(raw_text),
            "approval_number": _find_approval(raw_text),
            "merchant_name": _find_merchant(lines),
            "business_number": _find_business_number(raw_text),
            "raw_text": raw_text,
            "confidence_score": round(confidence, 4),
        }


def _find_card_last4(lines: list[str]) -> str | None:
    """마스킹된 카드번호의 끝 4자리. '1234-****-****-4821' → '4821'."""
    for line in lines:
        if not re.search(r"카드|CARD", line, re.I):
            continue
        matched = _CARD_TAIL.search(line.replace("*", "0"))
        if matched:
            return matched.group(1)
    for line in lines:  # 라벨 없는 영수증도 있어 한 번 더 훑는다
        matched = _CARD_TAIL.search(line.replace("*", "0"))
        if matched:
            return matched.group(1)
    return None


# 금액으로 착각하기 쉬운 줄 — 승인번호·사업자번호·카드번호·날짜가 붙은 줄은 건너뛴다.
# (승인번호 87654321 이 합계 8,250,000 보다 커서 총액으로 잡히는 사고가 있었다)
_NOT_AMOUNT = re.compile(
    r"승인\s*번호|approval|사업자|등록번호|카드|card|\d{3}-\d{2}-\d{5}"
    r"|20\d{2}\s*[-./년]",
    re.I,
)


def _amounts_in(line: str) -> list[int]:
    """줄에서 금액 후보를 뽑는다. 금액이 아닌 맥락의 줄은 아예 보지 않는다."""
    if _NOT_AMOUNT.search(line):
        return []
    found: list[int] = []
    for value in _AMOUNT.findall(line):
        digits = value.replace(",", "").split(".")[0]
        if digits.isdigit():
            found.append(int(digits))
    return found


def _find_amount(lines: list[str]) -> str | None:
    """총액을 찾는다.

    CLOVA 는 '합계'와 '8,250,000' 을 서로 다른 줄로 끊어 주기도 한다. 그래서
    라벨이 있는 줄에 숫자가 없으면 바로 다음 줄까지 본다.

    라벨을 못 찾으면 가장 큰 수를 쓰되, 승인번호·사업자번호처럼 금액이 아닌
    숫자가 섞인 줄은 후보에서 제외한다 — 예전에는 승인번호가 합계보다 커서
    그대로 결제금액이 돼 버렸다.
    """
    for index, line in enumerate(lines):
        if not _TOTAL_HINT.search(line):
            continue
        same_line = _amounts_in(line)
        if same_line:
            return str(max(same_line))
        for following in lines[index + 1 : index + 3]:
            nearby = _amounts_in(following)
            if nearby:
                return str(max(nearby))

    candidates: list[int] = []
    for line in lines:
        candidates.extend(_amounts_in(line))
    return str(max(candidates)) if candidates else None


def _find_date(text: str) -> str | None:
    matched = _DATE.search(text)
    if not matched:
        return None
    year, month, day = matched.groups()
    return f"{year}-{int(month):02d}-{int(day):02d}"


def _find_approval(text: str) -> str | None:
    matched = _APPROVAL.search(text)
    return matched.group(1) if matched else None


def _find_business_number(text: str) -> str | None:
    matched = _BIZNUM.search(text)
    return matched.group(1) if matched else None


def _find_merchant(lines: list[str]) -> str | None:
    """'상호: 메가스터디 입시학원' 처럼 라벨이 붙은 줄에서 값만 뽑는다.

    라벨 글자 사이에 OCR 잡음이 끼어 정규식이 빗나가는 경우가 있어(예: '상& 호'),
    구분자(:, |, -)가 있으면 그 뒤를 값으로 본다. 구분자가 없을 때만 라벨을
    지운다. 예전에는 지우기에만 의존해서 '상& 호 : 메가스터디 입시학원' 이
    그대로 학원명이 됐다.
    """
    for line in lines:
        if not _MERCHANT_HINT.search(line):
            continue
        value = line
        # 구분자 뒤가 값이다. 여러 개면 마지막 것 뒤를 쓴다.
        for separator in (":", "：", "|"):
            if separator in value:
                value = value.rsplit(separator, 1)[1]
                break
        else:
            value = _MERCHANT_HINT.sub("", value)
        value = value.strip(" :：;·|-&.,")
        if value:
            return value
    for line in lines:
        if "학원" in line:
            return line.strip()
    return lines[0].strip() if lines else None


class OCRService:
    def __init__(
        self,
        repository: OCRRepository,
        provider: OCRProvider,
        storage: Any | None = None,
    ):
        self.repository = repository
        self.provider = provider
        # 저장소를 알면 원격(Supabase·Blob)에 올라간 파일도 읽어서 넘길 수 있다.
        self.storage = storage

    def process_file(self, claim_id: int, locator: str | Path) -> dict:
        """locator 는 저장소가 돌려준 값이다 — 로컬은 경로, 원격은 URL/객체 키.

        원격이면 경로로 열리지 않으므로 저장소에서 바이트를 읽어 프로바이더에
        직접 넘긴다. (예전엔 로컬 경로로만 열어서 Supabase 저장 시 503 이 났다)
        """
        data: bytes | None = None
        if self.storage is not None:
            try:
                data = self.storage.read(str(locator))
            except Exception:  # noqa: BLE001 — 로컬 경로면 프로바이더가 직접 연다
                data = None
        return self.save_normalized(
            claim_id, self.provider.extract_receipt(str(locator), data)
        )

    def save_normalized(self, claim_id: int, raw: dict[str, Any]) -> dict:
        payment_date = normalize_payment_date(raw.get("payment_date"))
        values = {
            "claim_id": claim_id,
            "card_last4": normalize_card_last4(raw.get("card_last4")),
            "payment_amount": normalize_payment_amount(raw.get("payment_amount")),
            "payment_date": payment_date.isoformat() if payment_date else None,
            "approval_number": normalize_approval_number(
                raw.get("approval_number")
            ),
            "merchant_name": normalize_merchant_name(raw.get("merchant_name")),
            "business_number": normalize_business_number(
                raw.get("business_number")
            ),
            "raw_text": redact_raw_text(raw.get("raw_text")),
            "confidence_score": float(raw.get("confidence_score") or 0),
            "created_at": datetime.now(UTC).isoformat(),
        }
        return self.repository.upsert(values)

    def get_for_claim(self, claim_id: int) -> dict | None:
        return self.repository.get_for_claim(claim_id)
