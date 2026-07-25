"""돈워리 계산기 — 재수 비용을 우리 집 기준 단위로 환산.

`_archive/legacy-spa/src/App.jsx` 의 클라이언트 상수·환산식을 서버로 승격한 것.
웹과 앱이 같은 값을 쓰도록 단일 소스로 둔다.

★ 주의 — 이 모듈의 `지역`은 **학원비 시세 배율**이고, `engine.REGION_CHOICES` 의
  `지역규모`(학원밀집도지수)는 **요율 지표**다. 이름이 비슷하지만 전혀 다른 개념이며
  서로 섞어 쓰면 안 된다. 이 모듈의 값은 보험료에 아무 영향을 주지 않는다.

금액 단위는 전부 **만원**이다.
"""
from __future__ import annotations

# ── 재수 형태별 비용 (업계 평균) ────────────────────────────────────────────
#   monthly     : 월 비용
#   total       : 연 비용(10개월 기준)
#   cap         : 월 보장 상한
#   voucher_pct : 바우처 지원 비율(%)
COST_FORMS: dict[str, dict] = {
    "독학재수(독서실·인강)": {
        "monthly": 3.6, "total": 36, "cap": 70, "voucher_pct": 100,
        "note": "인강 패스 평균(메가스터디·대성마이맥) 기준",
    },
    "단과 통학": {
        "monthly": 58.6, "total": 586, "cap": 100, "voucher_pct": 60,
        "note": "단과 강의료 + 교재 등 부대비용 평균",
    },
    "재수종합학원": {
        "monthly": 191, "total": 1910, "cap": 140, "voucher_pct": 40,
        "note": "메이저 재종합반 5개사 평균(시대인재·강남대성 등)",
    },
    "기숙학원": {
        "monthly": 360, "total": 3600, "cap": 200, "voucher_pct": 20,
        "note": "상위 기숙학원 5개사 평균",
    },
}
DEFAULT_FORM = "재수종합학원"

# ── 학원비 시세 지역 배율 (요율과 무관) ─────────────────────────────────────
COST_REGIONS = [
    {"name": "서울 학군지", "pct": 120, "desc": "강남·목동·중계 등"},
    {"name": "서울 비학군지", "pct": 105, "desc": "서울 그 외 지역"},
    {"name": "수도권", "pct": 100, "desc": "경기·인천 (기준)"},
    {"name": "지방", "pct": 85, "desc": "광역시·지방권"},
]
DEFAULT_COST_REGION = "수도권"

# ── 환산 기준값 (통계 평균) ────────────────────────────────────────────────
SAVE_AVG = 180        # 가구 월 저축액 평균
INCOME_AVG = 660      # 가구 월 소득 평균
SEMESTER_COST = 355.3  # 사립대 한 학기 등록금 평균
OPP_AMOUNT = 3800     # 재수 1년의 기회비용(초임 연봉 기준)

# ── 선택지 (프론트 칩) ─────────────────────────────────────────────────────
SAVE_OPTIONS = [
    {"label": "선택안함", "value": None}, {"label": "50만원 미만", "value": 25},
    {"label": "50~100", "value": 75}, {"label": "100~150", "value": 125},
    {"label": "150~250", "value": 200}, {"label": "250만원 이상", "value": 300},
]
SIBLING_OPTIONS = [
    {"label": "선택안함", "value": None}, {"label": "1명", "value": 1},
    {"label": "2명", "value": 2}, {"label": "3명 이상", "value": 3},
]
RETIRE_OPTIONS = [
    {"label": "선택안함", "value": None}, {"label": "1억 미만", "value": 7500},
    {"label": "1~3억", "value": 20000}, {"label": "3~5억", "value": 40000},
    {"label": "5~7억", "value": 60000}, {"label": "7억 이상", "value": 80000},
]
INCOME_OPTIONS = [
    {"label": "선택안함", "value": None}, {"label": "300만원 미만", "value": 250},
    {"label": "300~450", "value": 375}, {"label": "450~600", "value": 525},
    {"label": "600~800", "value": 700}, {"label": "800만원 이상", "value": 900},
]

MONTHS_PER_YEAR = 10   # 재수 1년 = 실질 10개월 (레거시 SPA 와 동일)


def region_pct(region: str | None) -> int:
    """지역명 → 학원비 시세 배율(%)."""
    for r in COST_REGIONS:
        if r["name"] == region:
            return r["pct"]
    return 100


def catalog() -> dict:
    """프론트가 화면을 구성하는 데 필요한 정의 일체."""
    return {
        "forms": [{"name": k, **v} for k, v in COST_FORMS.items()],
        "default_form": DEFAULT_FORM,
        "regions": COST_REGIONS,
        "default_region": DEFAULT_COST_REGION,
        "averages": {
            "monthly_saving": SAVE_AVG, "monthly_income": INCOME_AVG,
            "semester_tuition": SEMESTER_COST, "opportunity_cost": OPP_AMOUNT,
        },
        "options": {
            "saving": SAVE_OPTIONS, "sibling": SIBLING_OPTIONS,
            "retirement": RETIRE_OPTIONS, "income": INCOME_OPTIONS,
        },
        "months_per_year": MONTHS_PER_YEAR,
        "unit": "만원",
    }


def estimate(form: str | None = None,
             region: str | None = None,
             adjust_pct: int | None = None,
             monthly_saving: int | None = None,
             monthly_income: int | None = None,
             sibling_count: int | None = None,
             retire_goal: int | None = None) -> dict:
    """재수 비용 → 우리 집 기준 환산.

    adjust_pct 를 주면 그 값을 쓰고, 없으면 region 의 시세 배율을 쓴다.
    monthly_saving/monthly_income 을 비우면 통계 평균으로 대체하고 그 사실을 표시한다.
    """
    form_name = form if form in COST_FORMS else DEFAULT_FORM
    f = COST_FORMS[form_name]
    pct = adjust_pct if adjust_pct is not None else region_pct(region or DEFAULT_COST_REGION)

    total = round(f["total"] * pct / 100)
    monthly_adj = total / MONTHS_PER_YEAR
    covered_month = min(monthly_adj, f["cap"])
    self_pay = round((monthly_adj - covered_month) * MONTHS_PER_YEAR)
    covered = total - self_pay

    save_val = monthly_saving if monthly_saving else SAVE_AVG
    income_val = monthly_income if monthly_income else INCOME_AVG

    result = {
        "form": form_name, "note": f["note"],
        "region": region or DEFAULT_COST_REGION, "adjust_pct": pct,
        "total": total,
        "monthly": round(monthly_adj, 1),
        "cap_monthly": f["cap"],
        "covered": covered,
        "self_pay": self_pay,
        "voucher_pct": f["voucher_pct"],
        "conversions": {
            "saving_months": max(round(total / save_val), 1),
            "income_months": round(total / income_val),
            "opportunity_ratio": round(total / OPP_AMOUNT * 100, 1),
        },
        "used_average": {
            "monthly_saving": not monthly_saving,
            "monthly_income": not monthly_income,
        },
        "unit": "만원",
    }
    # 형제가 2명 이상일 때만 등록금 학기 환산을 보여준다 (레거시 SPA 규칙)
    if sibling_count and sibling_count >= 2:
        result["conversions"]["tuition_semesters"] = round(total / SEMESTER_COST * 2) / 2
    if retire_goal:
        result["conversions"]["retirement_pct"] = round(total / retire_goal * 100)
    return result
