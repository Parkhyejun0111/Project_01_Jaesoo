"""KOSIS 사교육비조사 → 시도계수 (거시 배율).

  시도계수 = 시도 학생 1인당 월평균 사교육비 / 전국 평균

파라미터 코드(itmId·objL1)는 추측하지 않는다. 반드시 `getMeta&type=ITM` 응답에서
읽어 쓴다. 이 표(DT_1PE105)의 실측 메타 구조는 아래와 같다 (2026-07 확인):

  · 항목 축     : OBJ_ID="ITEM",  ITM_ID = T00 평균 / T01 초등학교 / T02 중학교
                                          / T03 고등학교 / T04 일반고   (단위 만원)
  · 분류 축     : OBJ_ID="C", OBJ_NM="시도별", OBJ_ID_SN="1"  → objL1
                  ITM_ID = 00 전국, 11 서울특별시, 21 부산 … 39 제주 (전국+17시도)
  · 수록기간    : getMeta&type=PRD → PRD_SE="년", 2009 ~ 2025
  · type="OBJ"  는 이 표에서 err 30(데이터 없음) 을 돌려준다. 분류 코드는 type=ITM
                  응답에 함께 들어 있으므로 OBJ 조회는 하지 않는다.

★ 실제 데이터 조회 엔드포인트 주의 —
  `statisticsData.do?method=getList` 는 이 표에 대해 err 20(필수요청변수 누락)을
  돌려준다. 파라미터 방식 조회는 `/openapi/Param/statisticsParameterData.do` 가
  받는다. 아래 DATA_URL 이 실측으로 200/정상응답을 확인한 주소다.
"""
from __future__ import annotations

import json
import re

from . import config, http

META_URL = "https://kosis.kr/openapi/statisticsData.do"
DATA_URL = "https://kosis.kr/openapi/Param/statisticsParameterData.do"

# 메타 응답은 키를 따옴표로 감싸지 않은 비표준 JSON 이다.
#   예) [{OBJ_ID:"ITEM",ITM_ID:"T00", …}]
# 반면 데이터 응답과 오류 응답은 정상 JSON 이다. 두 경우를 모두 받는다.
_BARE_KEY = re.compile(r'([{,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:')

# 시도 분류 축의 이름. 메타 OBJ_NM 이 이 말을 포함하는 축을 시도 축으로 본다.
_SIDO_AXIS_HINT = "시도"
# 전체학생 평균 항목의 이름 (ITM_NM 에 공백이 섞여 오므로 공백 제거 후 비교한다).
_AVERAGE_ITEM = "평균"
# 전국(합계) 분류코드는 메타의 ITM_NM 으로 찾는다 — 코드 "00" 을 가정하지 않는다.
_NATIONAL = "전국"


class KosisError(RuntimeError):
    """KOSIS 가 오류를 돌려주거나 응답 구조가 예상과 다를 때."""


def _loads(text: str):
    """KOSIS 응답 파싱. 따옴표 없는 키를 허용한다."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    repaired = _BARE_KEY.sub(r'\1"\2":', text)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError as exc:
        raise KosisError(
            f"KOSIS 응답을 JSON 으로 읽을 수 없다. 원문 앞부분: {text[:400]!r}"
        ) from exc


def _get(url: str, params: dict[str, str]):
    body = http.get_text(url, params)
    payload = _loads(body)
    if isinstance(payload, dict) and payload.get("err"):
        raise KosisError(
            f"KOSIS err={payload.get('err')} {payload.get('errMsg')} "
            f"(params={ {k: v for k, v in params.items() if k != 'apiKey'} })"
        )
    if not isinstance(payload, list) or not payload:
        raise KosisError(f"KOSIS 응답이 비어 있거나 배열이 아니다: {body[:400]!r}")
    return payload


# ── 1-1. 메타 조회 ──────────────────────────────────────────────────────────
def fetch_meta(meta_type: str) -> list[dict]:
    """getMeta 원문 파싱 결과. meta_type = TBL | ITM | PRD."""
    return _get(META_URL, {
        "method": "getMeta",
        "type": meta_type,
        "orgId": config.kosis_org_id(),
        "tblId": config.kosis_tbl_id(),
        "format": "json",
        "apiKey": config.kosis_api_key(),
    })


def parse_item_meta(rows: list[dict]) -> dict:
    """type=ITM 응답 → 실제 데이터 조회에 넣을 파라미터.

    반환:
      {
        "item_id":   "T00",                     # itmId
        "item_name": "평균",
        "items":     {"T00": "평균", ...},       # 선택 가능한 항목 전체
        "obj_param": "objL1",                    # 시도 분류가 실린 축
        "sido_codes": {"11": "서울특별시", ...},  # 전국 제외
        "national_code": "00",
      }
    """
    items: dict[str, str] = {}
    axes: dict[str, dict[str, str]] = {}
    axis_names: dict[str, str] = {}

    for row in rows:
        obj_id = (row.get("OBJ_ID") or "").strip()
        code = (row.get("ITM_ID") or "").strip()
        name = re.sub(r"\s+", "", row.get("ITM_NM") or "")
        if not code:
            continue
        if obj_id == "ITEM":
            items[code] = name
            continue
        # 분류 축. OBJ_ID_SN 이 축 번호 → objL{n}
        serial = (row.get("OBJ_ID_SN") or "").strip()
        if not serial:
            continue
        axes.setdefault(serial, {})[code] = name
        axis_names.setdefault(serial, (row.get("OBJ_NM") or "").strip())

    if not items:
        raise KosisError(
            "메타(type=ITM) 응답에 OBJ_ID='ITEM' 행이 없다. 실제 응답 구조가 예상과 "
            f"다르다: {json.dumps(rows[:3], ensure_ascii=False)}"
        )

    item_id = config.kosis_item_id()
    if item_id and item_id not in items:
        raise KosisError(
            f"KOSIS_ITM_ID={item_id} 가 메타 항목 목록에 없다. 사용 가능: {items}"
        )
    if not item_id:
        item_id = next((c for c, n in items.items() if _AVERAGE_ITEM in n), None)
        if item_id is None:
            raise KosisError(
                f"'{_AVERAGE_ITEM}'(전체학생 평균) 항목을 메타에서 찾지 못했다. 항목 목록: {items}"
            )

    serial = next((s for s, nm in axis_names.items() if _SIDO_AXIS_HINT in nm), None)
    if serial is None:
        raise KosisError(
            f"'{_SIDO_AXIS_HINT}' 분류 축을 메타에서 찾지 못했다. 축 목록: {axis_names}"
        )

    codes = axes[serial]
    national = next((c for c, n in codes.items() if n == _NATIONAL), None)
    if national is None:
        raise KosisError(
            f"'{_NATIONAL}'(합계) 분류코드를 찾지 못했다. 코드 목록: {codes}"
        )

    return {
        "item_id": item_id,
        "item_name": items[item_id],
        "items": items,
        "obj_param": f"objL{serial}",
        "axis_name": axis_names[serial],
        "sido_codes": {c: n for c, n in codes.items() if c != national},
        "national_code": national,
    }


def latest_year(rows: list[dict]) -> str:
    """type=PRD 응답 → 연간 수록기간의 마지막 연도."""
    for row in rows:
        if (row.get("PRD_SE") or "").strip() in {"년", "Y", "A"}:
            end = (row.get("END_PRD_DE") or "").strip()
            if end:
                return end
    raise KosisError(
        f"메타(type=PRD)에서 연간 수록기간을 찾지 못했다: {json.dumps(rows, ensure_ascii=False)}"
    )


# ── 1-2. 실제 데이터 조회 ───────────────────────────────────────────────────
def fetch_expense_rows(meta: dict, year: str) -> list[dict]:
    """해당 연도 시도별 1인당 월평균 사교육비 원본 행."""
    return _get(DATA_URL, {
        "method": "getList",
        "apiKey": config.kosis_api_key(),
        "orgId": config.kosis_org_id(),
        "tblId": config.kosis_tbl_id(),
        meta["obj_param"]: "ALL",
        "itmId": meta["item_id"],
        "prdSe": "Y",
        "startPrdDe": year,
        "endPrdDe": year,
        "format": "json",
        "jsonVD": "Y",
    })


# 분류 축 번호에 맞는 응답 컬럼: objL1 → C1 / C1_NM
def _code_columns(obj_param: str) -> tuple[str, str]:
    serial = obj_param.removeprefix("objL")
    return f"C{serial}", f"C{serial}_NM"


def parse_expense_rows(rows: list[dict], meta: dict) -> list[dict]:
    """원본 행 → [{code, official_name, sido, expense_manwon}] (전국 포함).

    금액 단위는 만원이다 (메타 UNIT_NM='만원').
    """
    code_col, name_col = _code_columns(meta["obj_param"])
    if code_col not in rows[0]:
        raise KosisError(
            f"데이터 응답에 분류 컬럼 {code_col} 이 없다. 실제 컬럼: {sorted(rows[0])}"
        )

    parsed: list[dict] = []
    for row in rows:
        raw = row.get("DT")
        if raw in (None, "", "-", "X"):
            continue
        try:
            value = float(str(raw).replace(",", ""))
        except ValueError:
            continue
        official = re.sub(r"\s+", "", row.get(name_col) or "")
        code = (row.get(code_col) or "").strip()
        parsed.append({
            "code": code,
            "official_name": official,
            "sido": short_sido_name(official),
            "expense_manwon": round(value, 5),
            "period": (row.get("PRD_DE") or "").strip(),
            "unit": (row.get("UNIT_NM") or "").strip(),
        })
    if not parsed:
        raise KosisError("데이터 응답에서 유효한 DT 값을 하나도 얻지 못했다.")
    return parsed


# ── 시도 표기 정규화 ────────────────────────────────────────────────────────
_SUFFIXES = ("특별자치도", "특별자치시", "특별시", "광역시", "자치도", "도")


def short_sido_name(official: str) -> str:
    """'충청북도' → '충북', '강원특별자치도' → '강원', '서울특별시' → '서울'.

    행정구역 개편(강원·전북의 특별자치도 전환처럼)으로 정식명이 바뀌어도 짧은 이름이
    유지되도록 규칙으로 깎는다. 고정 표를 두지 않는 이유가 이것이다.
    """
    name = re.sub(r"\s+", "", official or "")
    stripped = False
    for suffix in _SUFFIXES:
        if name.endswith(suffix) and len(name) > len(suffix):
            name = name[: -len(suffix)]
            stripped = True
            break
    # 충청북 → 충북, 경상남 → 경남 (3글자 도명은 1·3번째 글자만 남긴다).
    # 접미사를 실제로 떼어낸 경우에만 줄인다 — 그러지 않으면 '전국' 같은 값이나
    # 알 수 없는 입력('없는곳' → '없곳')까지 뭉개진다.
    if stripped and len(name) == 3:
        name = name[0] + name[2]
    return name


# ── 계수 산출 ───────────────────────────────────────────────────────────────
def build_sido_coefficients(parsed: list[dict], meta: dict) -> dict:
    """[{sido, expense_manwon}] → 전국 평균 대비 비율.

    반환은 config/sido_coefficients.json 의 내용 그대로다.
    """
    national = next((r for r in parsed if r["code"] == meta["national_code"]), None)
    if national is None or national["expense_manwon"] <= 0:
        raise KosisError("전국 평균 사교육비를 얻지 못해 비율을 계산할 수 없다.")

    base = national["expense_manwon"]
    rows = [r for r in parsed if r["code"] != meta["national_code"]]
    if not rows:
        raise KosisError("시도별 행이 비어 있다.")

    coefficients = {r["sido"]: round(r["expense_manwon"] / base, 4) for r in rows}
    return {
        "coefficients": coefficients,
        "national_average_manwon": base,
        "expenses_manwon": {r["sido"]: r["expense_manwon"] for r in rows},
        "official_names": {r["sido"]: r["official_name"] for r in rows},
        "source": {
            "provider": "통계청 KOSIS",
            "table_id": config.kosis_tbl_id(),
            "table_name": "학교급 및 시도별 학생 1인당 월평균 사교육비",
            "org_id": config.kosis_org_id(),
            "item_id": meta["item_id"],
            "item_name": meta["item_name"],
            "obj_param": meta["obj_param"],
            "axis_name": meta["axis_name"],
            "period": national["period"],
            "unit": national["unit"] or "만원",
        },
    }


def collect() -> dict:
    """메타 조회 → 데이터 조회 → 시도계수. 실패 시 KosisError."""
    meta = parse_item_meta(fetch_meta("ITM"))
    year = config.kosis_year() or latest_year(fetch_meta("PRD"))
    rows = fetch_expense_rows(meta, year)
    return build_sido_coefficients(parse_expense_rows(rows, meta), meta)
