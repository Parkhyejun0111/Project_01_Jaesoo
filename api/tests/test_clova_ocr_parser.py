"""CLOVA OCR 응답 → 영수증 필드 파서 테스트.

네트워크를 타지 않는다. 실제 CLOVA 응답 형태(fields[] + lineBreak)를 그대로
흉내 낸 입력으로 파싱만 검증한다 — 호출 자체는 실 영수증으로 따로 확인했다.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from receipt_verification.services.errors import OCRUnavailableError  # noqa: E402
from receipt_verification.services.ocr import ClovaOCRProvider  # noqa: E402


def field(text: str, line_break: bool = False, confidence: float = 0.99) -> dict:
    return {
        "inferText": text,
        "lineBreak": line_break,
        "inferConfidence": confidence,
    }


def body(*lines: list[str], confidence: float = 0.99) -> dict:
    """각 줄을 토큰 리스트로 받아 CLOVA 응답 모양으로 만든다."""
    fields = []
    for tokens in lines:
        for index, token in enumerate(tokens):
            fields.append(field(token, index == len(tokens) - 1, confidence))
    return {"images": [{"inferResult": "SUCCESS", "fields": fields}]}


def test_기본_영수증에서_일곱_필드를_뽑는다():
    parsed = ClovaOCRProvider.parse(
        body(
            ["OO기숙학원"],
            ["사업자번호", "123-45-67890"],
            ["신한카드", "1234-****-****-4821"],
            ["승인번호", "12345678"],
            ["거래일시", "2026-07-15"],
            ["합계", "15,000,000"],
        )
    )
    assert parsed["merchant_name"] == "OO기숙학원"
    assert parsed["business_number"] == "123-45-67890"
    assert parsed["card_last4"] == "4821"
    assert parsed["approval_number"] == "12345678"
    assert parsed["payment_date"] == "2026-07-15"
    assert parsed["payment_amount"] == "15000000"


def test_승인번호가_합계보다_커도_금액으로_잡지_않는다():
    """실제로 겪은 사고 — 승인번호 87654321 이 합계 8,250,000 보다 크다.

    폴백이 '가장 큰 수'였을 때 승인번호가 결제금액이 돼 버렸다.
    """
    parsed = ClovaOCRProvider.parse(
        body(
            ["대치명문재수학원"],
            ["합계"],
            ["8,250,000"],
            ["공급가액", "7,500,000"],
            ["KB국민카드"],
            ["5432-****-****-1098"],
            ["승인번호:", "87654321"],
            ["2026/07/03"],
        )
    )
    assert parsed["payment_amount"] == "8250000"
    assert parsed["approval_number"] == "87654321"
    assert parsed["card_last4"] == "1098"
    assert parsed["payment_date"] == "2026-07-03"


def test_합계와_금액이_다른_줄이어도_잡는다():
    """CLOVA 는 라벨과 값을 자주 끊어 준다."""
    parsed = ClovaOCRProvider.parse(body(["결제금액"], ["1,910,000"]))
    assert parsed["payment_amount"] == "1910000"


def test_라벨이_없으면_가장_큰_금액을_쓰되_번호는_제외한다():
    parsed = ClovaOCRProvider.parse(
        body(["1,200,000"], ["3,400,000"], ["사업자등록번호", "214-88-01234"])
    )
    assert parsed["payment_amount"] == "3400000"


def test_신뢰도는_평균이_아니라_최저값이다():
    """한 글자만 흐려도 승인번호가 통째로 틀어진다 — 평균이면 그게 묻힌다."""
    parsed = ClovaOCRProvider.parse(
        {
            "images": [
                {
                    "inferResult": "SUCCESS",
                    "fields": [
                        field("합계", True, 0.99),
                        field("15,000,000", True, 0.62),
                    ],
                }
            ]
        }
    )
    assert parsed["confidence_score"] == pytest.approx(0.62)


def test_인식_실패는_예외로_올린다():
    """호출부가 이 예외를 '확인 실패'로 처리해 카드사 이용내역 단계로 넘긴다."""
    with pytest.raises(OCRUnavailableError):
        ClovaOCRProvider.parse(
            {"images": [{"inferResult": "FAILURE", "message": "invalid image"}]}
        )


def test_이미지가_없으면_예외로_올린다():
    with pytest.raises(OCRUnavailableError):
        ClovaOCRProvider.parse({"images": []})


def test_키가_없으면_호출_전에_막는다():
    provider = ClovaOCRProvider(invoke_url="", secret_key="")
    with pytest.raises(OCRUnavailableError, match="설정되지 않았습니다"):
        provider.extract_receipt("/tmp/whatever.jpg")
