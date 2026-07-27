"""서울 열린데이터광장 학원 정보 → 구보정계수 (서울 내부 미시 배율).

  구보정계수 = 구별 학원 평균 수강료 / 서울 전체 평균 수강료

서울 밖(경기·인천·지방)에는 적용하지 않는다 — coefficients.py 가 1.0 을 쓴다.

★ 실측 컬럼명 주의 (2026-07 확인) —
  neisAcademyInfo 의 컬럼은 과거 문서에 흔히 적힌 이름과 다르다. 실제 응답 컬럼은
  아래와 같고, 이 모듈은 실제 이름만 쓴다.

      과거 표기            실제 컬럼            내용
      ACA_NM            → PEI_NM              학원·교습소명
      FA_RDNMA          → ROAD_NM_ADDR        도로명주소
      REALM_SC_NM       → FLD_NM              교습계열 ("입시.검정 및 보습")
      PSNBY_THCC_CNTNT  → INDV_ATNLC_AMT_CN   인당 수강료

  그리고 INDV_ATNLC_AMT_CN 은 숫자 한 개가 아니라 과정별 목록 문자열이다.
      "초등수학:140000, 중등수학:300000, 고등수학:450000"
  따라서 금액을 모두 뽑아 학원 단위로 평균한 뒤 구 단위로 다시 평균한다.
  (행 단위로 바로 평균하면 과정 수가 많은 학원이 과대대표된다.)

  수강료 공개율은 입시·보습 계열 14,139곳 중 3,466곳(약 25%)이다. 표본 수 n 을
  결과에 함께 남겨 구별 신뢰도를 확인할 수 있게 한다.
"""
from __future__ import annotations

import json
import re
import statistics
import time
from collections import defaultdict

from . import config, http

SERVICE = "neisAcademyInfo"
BASE_URL = "http://openapi.seoul.go.kr:8088"
PAGE_SIZE = 1000
PAGE_DELAY_SEC = 0.25

# 재수없수 상품 성격(입시·검정·보습)에 맞는 교습계열만 남긴다.
#   실제 FLD_NM 값은 마침표·공백이 섞인 "입시.검정 및 보습" 이므로 구두점을 지우고 비교한다.
TARGET_REALM = "입시검정및보습"

# 상위 이상치 절단 지점 — 상위 0.5% 는 결측 처리한다.
OUTLIER_QUANTILE = 0.995

# "…:150,000" / "… : 150000원" 형태에서 금액만 뽑는다.
_FEE = re.compile(r":\s*([0-9][0-9,]*)")
# 도로명주소에서 자치구를 뽑는다. "서울특별시 강남구 테헤란로 …" → "강남구"
_GU = re.compile(r"(?:^|\s)([가-힣]{1,5}구)(?=\s|$)")
_PUNCT = re.compile(r"[\s.·,]")


class SeoulApiError(RuntimeError):
    """서울 열린데이터광장이 오류를 돌려주거나 응답 구조가 예상과 다를 때."""


_XML_CODE = re.compile(r"<CODE>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*</CODE>", re.S)
_XML_MESSAGE = re.compile(r"<MESSAGE>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*</MESSAGE>", re.S)


def _describe_non_json(text: str) -> str:
    """JSON 이 아닌 응답(대개 XML 오류 문서)에서 코드·메시지를 뽑는다."""
    code = _XML_CODE.search(text)
    message = _XML_MESSAGE.search(text)
    if code or message:
        return (f"서울 API 오류 {code.group(1).strip() if code else '?'}: "
                f"{' '.join((message.group(1) if message else '').split())}")
    return f"서울 API 응답이 JSON 이 아니다. 원문 앞부분: {text[:200]!r}"


# ── 수집 ────────────────────────────────────────────────────────────────────
def _fetch_page(key: str, start: int, end: int) -> tuple[list[dict], int]:
    url = f"{BASE_URL}/{key}/json/{SERVICE}/{start}/{end}/"
    text = http.get_text(url)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        # 인증키가 틀리면 JSON 이 아니라 XML 오류 문서가 온다. 배치 로그에서 원인을
        # 바로 읽을 수 있도록 코드·메시지를 뽑아 올린다.
        raise SeoulApiError(_describe_non_json(text)) from exc

    body = payload.get(SERVICE)
    if body is None:
        result = payload.get("RESULT") or {}
        raise SeoulApiError(
            f"응답에 {SERVICE} 키가 없다. RESULT={result.get('CODE')} "
            f"{result.get('MESSAGE')} 원문: {json.dumps(payload, ensure_ascii=False)[:300]}"
        )
    code = (body.get("RESULT") or {}).get("CODE", "")
    if code and not code.startswith("INFO-000"):
        raise SeoulApiError(f"서울 API 오류 {code}: {(body.get('RESULT') or {}).get('MESSAGE')}")
    return body.get("row") or [], int(body.get("list_total_count") or 0)


def fetch_academies(*, page_size: int = PAGE_SIZE, delay: float = PAGE_DELAY_SEC) -> list[dict]:
    """서울 전체 학원·교습소를 1000건 단위로 페이지네이션해 모은다."""
    key = config.seoul_api_key()
    rows: list[dict] = []
    start = 1
    total = None
    while True:
        page, total = _fetch_page(key, start, start + page_size - 1)
        if not page:
            break
        rows.extend(page)
        start += page_size
        if total and start > total:
            break
        time.sleep(delay)
    if not rows:
        raise SeoulApiError("학원 데이터를 한 건도 받지 못했다.")
    if total and len(rows) < total * 0.9:
        raise SeoulApiError(f"수집 건수가 총계보다 크게 적다 ({len(rows)}/{total}) — 페이지네이션 확인 필요.")
    return rows


# ── 파싱 ────────────────────────────────────────────────────────────────────
def extract_gu(address: str | None) -> str | None:
    """도로명주소에서 자치구를 뽑는다. 실패하면 None."""
    match = _GU.search(address or "")
    return match.group(1) if match else None


def parse_fees(text: str | None) -> list[int]:
    """'초등수학:140000, 고등수학:450000' → [140000, 450000].

    0원은 결측으로 보고 버린다 (수강료 미기재를 0 으로 채운 행이 있다).
    """
    fees = []
    for raw in _FEE.findall(text or ""):
        try:
            value = int(raw.replace(",", ""))
        except ValueError:
            continue
        if value > 0:
            fees.append(value)
    return fees


def is_target_realm(realm: str | None) -> bool:
    """교습계열이 입시·검정·보습 계열인가."""
    return TARGET_REALM in _PUNCT.sub("", realm or "")


def select_columns(rows: list[dict]) -> list[dict]:
    """필요한 컬럼만 남기고 입시·보습 계열로 필터링한다.

    남기는 것: 학원명 / 주소 / 교습계열 / 인당수강료 (+ 구, 파싱된 수강료)
    """
    if rows and "INDV_ATNLC_AMT_CN" not in rows[0]:
        raise SeoulApiError(
            "응답에 수강료 컬럼 INDV_ATNLC_AMT_CN 이 없다. 실제 컬럼: "
            f"{sorted(rows[0])}"
        )

    selected: list[dict] = []
    for row in rows:
        if not is_target_realm(row.get("FLD_NM")):
            continue
        address = row.get("ROAD_NM_ADDR")
        gu = extract_gu(address) or (row.get("ADMDST_NM") or "").strip() or None
        selected.append({
            "name": (row.get("PEI_NM") or "").strip(),
            "address": address,
            "realm": (row.get("FLD_NM") or "").strip(),
            "fee_text": row.get("INDV_ATNLC_AMT_CN") or "",
            "gu": gu,
            "fees": parse_fees(row.get("INDV_ATNLC_AMT_CN")),
        })
    return selected


def _quantile_cut(values: list[float], q: float) -> float:
    """q 분위 값. 이 값보다 '큰' 것만 이상치로 버린다 (경계값은 남긴다).

    경계에서 `<` 를 쓰면 동일 금액이 분위점에 몰린 경우 표본이 통째로 날아간다
    (예: 200곳이 같은 30만원이고 1곳만 9,900만원이면 분위점이 30만원이 되어
    `< 30만원` 조건에 아무것도 안 남는다). 그래서 `<=` 로 남긴다.
    """
    ordered = sorted(values)
    index = min(int(len(ordered) * q), len(ordered) - 1)
    return ordered[index]


# ── 계수 산출 ───────────────────────────────────────────────────────────────
def build_gu_coefficients(rows: list[dict]) -> dict:
    """원본 행 → 구보정계수.

    1) 입시·보습 계열만 남기고 구를 뽑는다
    2) 학원별 평균 수강료를 만든다 (0원·미기재는 이미 제외)
    3) 상위 0.5% 는 이상치로 결측 처리해 제외한다
    4) 구별 평균 → 서울 전체 평균으로 나눈다
    """
    selected = select_columns(rows)
    priced = [r for r in selected if r["gu"] and r["fees"]]
    if not priced:
        raise SeoulApiError("수강료가 공개된 입시·보습 학원이 한 곳도 없다.")

    academy_means = [(r["gu"], statistics.mean(r["fees"])) for r in priced]
    cut = _quantile_cut([m for _, m in academy_means], OUTLIER_QUANTILE)
    kept = [(gu, mean) for gu, mean in academy_means if mean <= cut]
    if not kept:
        raise SeoulApiError("이상치 절단 후 남은 표본이 없다.")

    by_gu: dict[str, list[float]] = defaultdict(list)
    for gu, mean in kept:
        by_gu[gu].append(mean)

    seoul_mean = statistics.mean([m for _, m in kept])
    coefficients = {gu: round(statistics.mean(v) / seoul_mean, 4)
                    for gu, v in sorted(by_gu.items())}

    return {
        "coefficients": coefficients,
        "seoul_average_fee_won": round(seoul_mean),
        "average_fee_won": {gu: round(statistics.mean(v)) for gu, v in sorted(by_gu.items())},
        "sample_size": {gu: len(v) for gu, v in sorted(by_gu.items())},
        "source": {
            "provider": "서울 열린데이터광장",
            "service": SERVICE,
            "realm_filter": "입시.검정 및 보습",
            "columns": ["PEI_NM", "ROAD_NM_ADDR", "FLD_NM", "INDV_ATNLC_AMT_CN"],
            "fetched_rows": len(rows),
            "realm_rows": len(selected),
            "priced_academies": len(priced),
            "kept_academies": len(kept),
            "outlier_cut_won": round(cut),
            "unit": "원",
        },
    }


def collect() -> dict:
    """수집 → 구보정계수. 실패 시 SeoulApiError."""
    return build_gu_coefficients(fetch_academies())
