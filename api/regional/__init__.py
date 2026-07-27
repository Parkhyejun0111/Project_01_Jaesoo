"""2단 구조 지역계수 — 거시(시도) × 미시(서울 구).

  최종 지역계수 = 시도계수 × 구보정계수

  · 시도계수   : 통계청 KOSIS 초중고 사교육비조사(DT_1PE105). 전국 17개 시도의
                 학생 1인당 월평균 사교육비를 전국 평균 대비 비율로 환산.
  · 구보정계수 : 서울 열린데이터광장 학원 정보(neisAcademyInfo). 서울 각 구의
                 입시·보습 학원 평균 수강료를 서울 전체 평균 대비 비율로 환산.
                 서울 밖에서는 1.0 이다.

  · 학원 수/밀도는 이번 범위에서 제외했다. coefficients.get_region_coefficient 의
    density_weight 인자가 향후 확장 자리다.

수집(월 1회 배치):   python -m regional.collect
런타임 조회:         from regional import get_region_coefficient
"""
from .coefficients import (
    DEFAULT_COEFFICIENT,
    breakdown,
    get_region_coefficient,
    gu_coefficient,
    load,
    sido_coefficient,
    sources,
    table,
)

__all__ = [
    "DEFAULT_COEFFICIENT",
    "breakdown",
    "get_region_coefficient",
    "gu_coefficient",
    "load",
    "sido_coefficient",
    "sources",
    "table",
]
