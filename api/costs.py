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
#   레거시 SPA 가 쓰던 4단 수기 배율. 사용자가 시도·구를 고르지 않았을 때의
#   폴백이자 하위호환 경로로 남긴다. 새 화면은 아래 데이터 기반 지역계수를 쓴다.
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
    """지역명 → 학원비 시세 배율(%). 레거시 4단 배율."""
    for r in COST_REGIONS:
        if r["name"] == region:
            return r["pct"]
    return 100


# ── 데이터 기반 지역계수 (2단 구조) ─────────────────────────────────────────
#   시도계수(KOSIS 사교육비) × 구보정계수(서울 학원 단가). 상세는 regional 패키지.
#   여기서는 조회만 한다 — API 호출은 월 1회 배치가 하고, 런타임은 캐시 JSON 만 읽는다.
def region_catalog() -> dict:
    """거주지 선택지 — 시도 17개 + 서울 자치구 25개."""
    from regional import coefficients as rc

    data = rc.load()
    sido = data["sido"]
    gu = data["gu"]
    return {
        # 계수가 큰 순서로 보여주면 "우리 지역이 비싼 편인가"를 바로 읽을 수 있다.
        "sido": [{"name": name, "coefficient": value}
                 for name, value in sorted(sido.items(), key=lambda kv: -kv[1])],
        "seoul_gu": [{"name": name, "coefficient": value}
                     for name, value in sorted(gu.items(), key=lambda kv: -kv[1])],
        "default_sido": DEFAULT_SIDO if DEFAULT_SIDO in sido else None,
        "default_coefficient": rc.DEFAULT_COEFFICIENT,
        "available": data["available"],
        "sources": rc.sources(),
        "groups": region_groups(),
    }


# ── 거주지 선택 화면의 4분류 ───────────────────────────────────────────────
#   화면은 "서울 학군지 / 서울 비학군지 / 수도권 / 지방" 네 탭으로 묶어 보여준다.
#   묶음 정의를 프론트에 두면 학군지 기준이 두 군데 생겨서, 설명 문구("학군지라
#   학원비가 높은 편이에요")와 화면 분류가 서로 어긋날 수 있다. 그래서 여기서만 정한다.
METRO_SIDO = ("경기", "인천")   # 수도권 — 서울은 앞의 두 탭이 따로 받는다


def region_groups() -> list[dict]:
    """4개 탭 정의 — 각 탭이 어떤 시도/구를 담는지까지 서버가 알려준다.

    탭을 눌러 고른 항목은 결국 (시도, 구) 한 쌍으로 환원된다. 즉 이 화면은
    데이터 기반 지역계수를 그대로 쓰고, 레거시 COST_REGIONS 배율은 쓰지 않는다.
      · 서울 학군지 / 비학군지 → sido="서울", gu=<자치구>
      · 수도권 / 지방          → sido=<시도>,  gu=None
    """
    from dontworry_explain import SCHOOL_DISTRICT_THRESHOLD
    from regional import coefficients as rc

    data = rc.load()
    gu = sorted(data["gu"].items(), key=lambda kv: -kv[1])
    sido = sorted(data["sido"].items(), key=lambda kv: -kv[1])

    def entries(pairs) -> list[dict]:
        return [{"name": n, "coefficient": v} for n, v in pairs]

    return [
        {
            "key": "seoul_edu",
            "label": "서울 학군지",
            "desc": "강남·서초·목동 등",
            "sido": rc.SEOUL,
            "items": entries((n, v) for n, v in gu if v >= SCHOOL_DISTRICT_THRESHOLD),
        },
        {
            "key": "seoul_other",
            "label": "서울 비학군지",
            "desc": "서울 그 외 자치구",
            "sido": rc.SEOUL,
            "items": entries((n, v) for n, v in gu if v < SCHOOL_DISTRICT_THRESHOLD),
        },
        {
            "key": "metro",
            "label": "수도권",
            "desc": "경기·인천",
            "sido": None,          # 항목 자체가 시도다
            "items": entries((n, v) for n, v in sido if n in METRO_SIDO),
        },
        {
            "key": "local",
            "label": "지방",
            "desc": "광역시·지방권",
            "sido": None,
            "items": entries(
                (n, v) for n, v in sido if n not in METRO_SIDO and n != rc.SEOUL
            ),
        },
    ]


DEFAULT_SIDO = "경기"   # 전국 평균에 가장 가까운 수도권 — 첫 화면 기본 선택


def catalog() -> dict:
    """프론트가 화면을 구성하는 데 필요한 정의 일체."""
    return {
        "forms": [{"name": k, **v} for k, v in COST_FORMS.items()],
        "default_form": DEFAULT_FORM,
        "regions": COST_REGIONS,
        "default_region": DEFAULT_COST_REGION,
        "region_coefficients": region_catalog(),
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
             retire_goal: int | None = None,
             sido: str | None = None,
             gu: str | None = None) -> dict:
    """재수 비용 → 우리 집 기준 환산.

    배율은 우선순위가 있다:
      1) adjust_pct — 사용자가 직접 만진 값
      2) sido(+gu)  — 데이터 기반 지역계수 (시도계수 × 구보정계수)
      3) region     — 레거시 4단 시세 배율 (아무것도 안 고른 경우)

    monthly_saving/monthly_income 을 비우면 통계 평균으로 대체하고 그 사실을 표시한다.
    """
    form_name = form if form in COST_FORMS else DEFAULT_FORM
    f = COST_FORMS[form_name]

    # 지역계수는 sido 를 줬을 때만 쓴다. 매핑 실패 시 breakdown 이 1.0 을 돌려준다.
    coefficient = _region_breakdown(sido, gu)
    if adjust_pct is not None:
        pct = adjust_pct
    elif coefficient is not None:
        pct = round(coefficient["coefficient"] * 100)
    else:
        pct = region_pct(region or DEFAULT_COST_REGION)

    total = round(f["total"] * pct / 100)
    monthly_adj = total / MONTHS_PER_YEAR
    covered_month = min(monthly_adj, f["cap"])
    self_pay = round((monthly_adj - covered_month) * MONTHS_PER_YEAR)
    covered = total - self_pay

    save_val = monthly_saving if monthly_saving else SAVE_AVG
    income_val = monthly_income if monthly_income else INCOME_AVG

    # 화면 라벨 — 지역계수를 썼으면 "서울 강남구", 아니면 레거시 시세 구간명.
    if coefficient is not None:
        region_label = " ".join(x for x in (coefficient["sido"], coefficient["gu"]) if x)
    else:
        region_label = region or DEFAULT_COST_REGION

    result = {
        "form": form_name, "note": f["note"],
        "region": region_label, "adjust_pct": pct,
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

    if coefficient is not None:
        national = round(f["total"])              # 지역계수 1.0 = 전국 평균 기준 비용
        result["region_coefficient"] = coefficient
        result["national_total"] = national
        # "전국 평균 대비 O.OO배" — 표시 총액을 반올림한 뒤의 실제 비율로 계산한다.
        # 계수를 그대로 쓰면 화면의 두 숫자(총액·배율)가 어긋나 보인다.
        result["vs_national"] = round(total / national, 2) if national else 1.0
    return result


def _region_breakdown(sido: str | None, gu: str | None) -> dict | None:
    """지역계수와 그 근거. sido 를 주지 않았으면 None (레거시 경로)."""
    if not sido:
        return None
    from regional import coefficients as rc

    return rc.breakdown(sido, gu)
