"""최종 지역계수 — 앱 런타임이 쓰는 읽기 전용 조회부.

  최종 지역계수 = 시도계수(거시, KOSIS 사교육비) × 구보정계수(미시, 서울 학원 단가)

두 계수를 곱하는 것이 이중계상이 아닌 이유: 시도계수는 '전국 대비 그 시도'의 수준을
잡고, 구보정계수는 '서울 평균 대비 그 구'의 편차를 잡는다. 구보정계수는 서울 안에서
평균이 1 근처이므로 서울의 수준 자체를 두 번 세지 않는다. 층위가 다른 두 배율이다.

이 모듈은 API 를 호출하지 않는다. 배치(collect.py)가 만들어 둔 config/*.json 만
읽는다. 실시간 호출 금지 — 배치 실패 시에도 직전 캐시가 그대로 서비스된다.
"""
from __future__ import annotations

import json
import re
import threading
from pathlib import Path

from . import config

DEFAULT_COEFFICIENT = 1.0
SEOUL = "서울"

_lock = threading.Lock()
_cache: dict | None = None

_SUFFIXES = ("특별자치도", "특별자치시", "특별시", "광역시", "자치도", "도")


def _short(name: str) -> str:
    """'서울특별시' → '서울'. kosis.short_sido_name 과 같은 규칙을 유지해야 한다."""
    text = re.sub(r"\s+", "", name or "")
    stripped = False
    for suffix in _SUFFIXES:
        if text.endswith(suffix) and len(text) > len(suffix):
            text = text[: -len(suffix)]
            stripped = True
            break
    if stripped and len(text) == 3:
        text = text[0] + text[2]
    return text


def _read(filename: str) -> dict | None:
    path = config.resolve_read_path(filename)
    if path is None:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        # 파일이 깨졌으면 계수 없이 1.0 으로 동작한다 — 화면이 죽는 것보다 낫다.
        return None


def load(*, refresh: bool = False) -> dict:
    """계수 묶음을 읽어 캐시한다.

    반환:
      {"sido": {…}, "gu": {…}, "sido_meta": {…}, "gu_meta": {…}, "generated_at": str|None}
    """
    global _cache
    with _lock:
        if _cache is not None and not refresh:
            return _cache

        final = _read(config.FINAL_FILE) or {}
        sido_doc = _read(config.SIDO_FILE) or {}
        gu_doc = _read(config.GU_FILE) or {}

        # 정본은 결합 캐시(final). 없으면 개별 파일에서 조립한다.
        sido = dict(final.get("sido_coefficients") or sido_doc.get("coefficients") or {})
        gu = dict(final.get("seoul_gu_coefficients") or gu_doc.get("coefficients") or {})

        _cache = {
            "sido": sido,
            "gu": gu,
            "sido_meta": final.get("sido_source") or sido_doc.get("source") or {},
            "gu_meta": final.get("gu_source") or gu_doc.get("source") or {},
            "generated_at": final.get("generated_at"),
            "available": bool(sido),
        }
        return _cache


def sido_coefficient(sido: str | None) -> float:
    """시도계수. 모르는 지역은 1.0(전국 평균)."""
    table = load()["sido"]
    if not sido:
        return DEFAULT_COEFFICIENT
    key = _short(sido)
    return float(table.get(key, table.get(sido.strip(), DEFAULT_COEFFICIENT)))


def gu_coefficient(sido: str | None, gu: str | None) -> float:
    """구보정계수. 서울이 아니거나 모르는 구면 1.0."""
    if not gu or _short(sido or "") != SEOUL:
        return DEFAULT_COEFFICIENT
    return float(load()["gu"].get(gu.strip(), DEFAULT_COEFFICIENT))


def get_region_coefficient(sido: str | None,
                           gu: str | None = None,
                           *,
                           density_weight: float | None = None) -> float:
    """최종 지역계수 = 시도계수 × 구보정계수.

    지역 매핑이 실패하면(신규·불명 지역, 계수 파일 없음) 1.0 = 전국 평균으로 떨어진다.

    density_weight 는 지금 쓰지 않는다 — None 이면 무시한다.
      # TODO(향후 확장 — 지금은 구현하지 않음):
      #   학원 수/밀도를 지역계수에 반영하고 싶어지면 여기서 density_weight 를 곱한다.
      #   서울 열린데이터광장 응답의 PSCP_SUM(정원)·행정구역별 학원 수로 밀도를 만들 수
      #   있다. 시그니처를 미리 열어 두었으니 호출부 변경 없이 확장 가능하다.
    """
    coefficient = sido_coefficient(sido) * gu_coefficient(sido, gu)
    if density_weight is not None:
        coefficient *= float(density_weight)
    return round(coefficient, 4)


def breakdown(sido: str | None, gu: str | None = None) -> dict:
    """계수와 그 근거를 함께 — 화면 각주·디버깅용."""
    data = load()
    sido_key = _short(sido or "")
    gu_key = (gu or "").strip() or None
    sido_c = sido_coefficient(sido)
    gu_c = gu_coefficient(sido, gu)
    return {
        "sido": sido_key or None,
        "gu": gu_key if sido_key == SEOUL else None,
        "sido_coefficient": round(sido_c, 4),
        "gu_coefficient": round(gu_c, 4),
        "coefficient": round(sido_c * gu_c, 4),
        "matched_sido": sido_key in data["sido"],
        "matched_gu": bool(gu_key) and sido_key == SEOUL and gu_key in data["gu"],
        "fallback": not data["available"],
    }


def sources() -> dict:
    """각주 문구용 출처·갱신시점."""
    data = load()
    sido_meta, gu_meta = data["sido_meta"], data["gu_meta"]
    return {
        "sido": {
            "provider": sido_meta.get("provider", "통계청 KOSIS"),
            "dataset": sido_meta.get("table_name", "초중고 사교육비조사"),
            "table_id": sido_meta.get("table_id"),
            "item_name": sido_meta.get("item_name"),
            "period": sido_meta.get("period"),
        },
        "gu": {
            "provider": gu_meta.get("provider", "서울 열린데이터광장"),
            "dataset": gu_meta.get("service", "학원 정보"),
            "realm_filter": gu_meta.get("realm_filter"),
            "sample_size": gu_meta.get("kept_academies"),
        },
        "generated_at": data["generated_at"],
        "available": data["available"],
        "note": "시도 배율은 연 1회 공표되는 사교육비조사, 서울 내 구간 보정은 월 1회 재수집한다.",
    }


def table() -> dict:
    """전체 계수 표 — /api/region-coefficients 응답."""
    data = load()
    return {
        "sido_coefficients": data["sido"],
        "seoul_gu_coefficients": data["gu"],
        "default": DEFAULT_COEFFICIENT,
        "sources": sources(),
    }


def config_paths() -> list[Path]:
    """디버깅용 — 어느 디렉터리를 보고 있는지."""
    return config.config_dirs()
