"""개인화 산정 엔진 — KELS 재수위험확률 스코어카드(최종) 기반

근거: FINAL/(오늘최종)KELS_재수위험확률_최종(스코어카드기준).ipynb  셀 ⑥·⑦-1
  · 위험확률(2항 구조): P(사고 j) = P(급락 j) × P(재수 | 급락 j)
      - 급락 임계: 경증 −2.5σ < z ≤ −2.0σ,  중증 z ≤ −2.5σ
      - P(급락): 경증 0.0162, 중증 0.0168 (표본 관측)
      - P(재수|급락): 개인별 스코어카드 R_i 를 관측 재수율로 앵커링
  · 확정 요율식(인강 임베디드 채널): 영업보험료 = (기대손실 × (1+θ) + F) ÷ (1 − c − v)
      - θ=0.24, F=9,950원, c=0.12, v=0.03, 보장률=0.70, 납입 33개월(고1 3월 기준)

원칙: 엔진이 숫자를 계산하고, LLM 은 그 값을 설명만 한다.
"""
from __future__ import annotations

import math

# ── 계리 상수 (노트북 확정값) ──────────────────────────────────────────────
P_MILD, P_SEV = 0.0162, 0.0168          # P(급락 경증/중증)
R_MILD_OBS, R_SEV_OBS = 0.280, 0.423    # 구간별 관측 재수율
R_MEAN = 0.273                          # 포트폴리오 평균 재수확률(앵커)
THETA, F_FIX, C_RATE, V_RATE = 0.24, 9950, 0.12, 0.03
COVER_RATE = 0.70                       # 보장률
MONTHS_BASE = 33                        # 고1 3월 가입 기준 납입개월

# 티어: (상품, 재수형태, 월 재수비용)
TIER_DEFS = [
    ("라이트", "독학재수", 500_000),
    ("스탠다드", "단과 통학", 1_000_000),
    ("플러스", "재종합학원", 1_670_000),
    ("프리미엄", "기숙학원", 2_500_000),
]


def _to_manwon(x: float) -> int:
    """보장금액은 만원 단위로 반올림 — 화면에 '1,402.8만원' 같은 소수점이 나오지 않도록."""
    return round(x / 10_000) * 10_000


def _cover(monthly_cost: int) -> tuple[int, int]:
    """(경증보장, 중증보장) — 경증 6개월, 중증 12개월 × 보장률."""
    return _to_manwon(monthly_cost * 6 * COVER_RATE), _to_manwon(monthly_cost * 12 * COVER_RATE)


def _gross(el: float, months: int = MONTHS_BASE) -> tuple[int, int]:
    """기대손실 → (연 영업보험료, 월납)."""
    g = (el * (1 + THETA) + F_FIX) / (1 - C_RATE - V_RATE)
    return round(g), round(g / months)


# ── 성적 분석 ────────────────────────────────────────────────────────────────
def _std(xs):
    if len(xs) < 2:
        return 0.0
    m = sum(xs) / len(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs))


def _trend(xs):
    n = len(xs)
    if n < 2:
        return 0.0
    mx = (n - 1) / 2
    my = sum(xs) / n
    num = sum((i - mx) * (xs[i] - my) for i in range(n))
    den = sum((i - mx) ** 2 for i in range(n))
    return num / den if den else 0.0


def analyze(scores: dict) -> dict:
    subjects = {}
    for subj, arr in scores.items():
        series = [p["percentile"] for p in sorted(arr, key=lambda x: x["seq"])]
        if not series:
            continue
        mean = sum(series) / len(series)
        vol = _std(series)
        tr = _trend(series)
        last = series[-1]
        predicted = max(0, min(100, last + tr * 1.5))
        sigma = max(vol, 3.0)
        subjects[subj] = {
            "series": [round(x, 1) for x in series],
            "mean": round(mean, 1), "volatility": round(vol, 1), "trend": round(tr, 2),
            "predicted": round(predicted, 1),
            "band_low": round(max(0, predicted - 1.65 * sigma), 1),
            "band_high": round(min(100, predicted + 1.65 * sigma), 1),
            "vol_index": min(100, round(vol / 15 * 100)),
        }
    if subjects:
        comp_pred = sum(s["predicted"] for s in subjects.values()) / len(subjects)
        comp_sigma = sum(s["volatility"] for s in subjects.values()) / len(subjects)
    else:
        comp_pred, comp_sigma = 0, 0
    weak = sorted(
        ({"subject": k, "volatility": v["volatility"], "trend": v["trend"],
          "risk_score": round(v["volatility"] - v["trend"] * 3, 1)} for k, v in subjects.items()),
        key=lambda x: -x["risk_score"],
    )
    return {
        "subjects": subjects, "weak_subjects": weak,
        "composite": {
            "predicted": round(comp_pred, 1), "sigma": round(comp_sigma, 1),
            "band_low": round(max(0, comp_pred - 1.65 * max(comp_sigma, 3)), 1),
            "band_high": round(min(100, comp_pred + 1.65 * max(comp_sigma, 3)), 1),
        },
    }


# ── 개인 재수확률 R_i (스코어카드) ──────────────────────────────────────────
_SCORE_INTERCEPT = -0.979  # 평균 프로필 → R≈0.273 로 앵커


def _R_from_logit(x: float) -> float:
    return round(max(0.10, min(0.95, 1 / (1 + math.exp(-x)))), 4)


def scorecard_R(analysis: dict, enrollment: dict | None) -> tuple[float, dict]:
    """성적 변동성/추세 + 청약서 요율문항 → 개인 재수확률 R_i, 점수 기여 내역."""
    subs = analysis.get("subjects", {})
    vol_max = max((v["volatility"] for v in subs.values()), default=6)
    trend_avg = sum(v["trend"] for v in subs.values()) / len(subs) if subs else 0
    e = enrollment or {}
    intent = e.get("retake_intent", 3)
    gap = e.get("target_gap", "near")
    income = e.get("income_band", 3)
    region = e.get("region", "수도권")

    pts = {
        "재수 의향": round((intent - 3) * 0.35, 3),
        "목표 격차": 0.50 if gap == "far" else -0.20,
        "성적 변동성": 0.40 if vol_max >= 12 else 0.12 if vol_max >= 7 else -0.20,
        "성적 추세": 0.30 if trend_avg < -0.5 else -0.30 if trend_avg > 0.5 else 0.0,
        "가구 배경": round((income - 3) * 0.10 + (0.15 if region == "서울 학군지" else 0.0), 3),
    }
    x = _SCORE_INTERCEPT + sum(pts.values())
    return _R_from_logit(x), pts


def price_for_tier(R: float, tier_name: str, months: int = MONTHS_BASE) -> dict:
    """개인 R_i + 티어 → 경증/중증위험·기대손실·영업보험료·월납."""
    tier = next((t for t in TIER_DEFS if t[0] == tier_name), TIER_DEFS[1])
    _, 형태, 월비용 = tier
    c_mild, c_sev = _cover(월비용)
    r_mild = P_MILD * R * (R_MILD_OBS / R_MEAN)
    r_sev = P_SEV * R * (R_SEV_OBS / R_MEAN)
    el = r_mild * c_mild + r_sev * c_sev
    gross, monthly = _gross(el, months)
    return {
        "tier": tier_name, "form": 형태, "monthly_cost": 월비용,
        "cover_mild": c_mild, "cover_sev": c_sev,
        "risk_mild": round(r_mild, 5), "risk_sev": round(r_sev, 5), "risk_total": round(r_mild + r_sev, 5),
        "expected_loss": round(el), "gross_annual": gross, "monthly_premium": monthly,
    }


def factor_premium_rates(pts: dict, tier_name: str, months: int = MONTHS_BASE) -> dict:
    """각 요인이 월 보험료에 준 상승/하강률(%).
       그 요인의 기여를 뺐을(=중립) 때의 보험료 대비 실제 보험료의 증감률.
       확률·점수·수식을 노출하지 않고 '보험료가 몇 % 오르내렸는지'만 설명하기 위한 값.
       요인들이 비선형(로짓)이라 각 %가 정확히 합산되지는 않는다(요인별 단독 기여치)."""
    x = _SCORE_INTERCEPT + sum(pts.values())
    base = price_for_tier(_R_from_logit(x), tier_name, months)["monthly_premium"]
    rates: dict[str, float] = {}
    for k, v in pts.items():
        prem_wo = price_for_tier(_R_from_logit(x - v), tier_name, months)["monthly_premium"]
        rates[k] = round((base - prem_wo) / prem_wo * 100, 1) if prem_wo else 0.0
    return rates


def tier_table(R: float | None = None) -> list[dict]:
    """티어 선택 화면용 표. R 없으면 포트폴리오 평균(R_MEAN) 기준선."""
    RR = R if R is not None else R_MEAN
    rows = []
    for name, 형태, 월비용 in TIER_DEFS:
        p = price_for_tier(RR, name)
        rows.append({
            "tier": name, "form": 형태,
            "cover_mild": p["cover_mild"], "cover_sev": p["cover_sev"],
            "cover_year_max": p["cover_sev"], "monthly_premium": p["monthly_premium"],
            "gross_annual": p["gross_annual"],
        })
    return rows


def price(analysis: dict, enrollment: dict | None) -> dict:
    R, pts = scorecard_R(analysis, enrollment)
    tier = (enrollment or {}).get("tier") or "스탠다드"
    p = price_for_tier(R, tier)
    # 설명용 기여도(정규화)
    tot = sum(abs(v) for v in pts.values()) or 1
    contrib = {k: round(abs(v) / tot, 3) for k, v in pts.items()}
    # 고객 안내용: 요인별 보험료 상승/하강률(%) — 원점수·확률 대신 이 값만 노출한다.
    factor_rates = factor_premium_rates(pts, tier)
    return {
        "tier": tier, "risk_prob": round(p["risk_total"], 4), "R": R,
        "monthly_premium": p["monthly_premium"], "gross_annual": p["gross_annual"],
        "expected_loss": p["expected_loss"], "coverage": p["cover_sev"],
        "cover_mild": p["cover_mild"], "cover_sev": p["cover_sev"],
        "risk_mild": p["risk_mild"], "risk_sev": p["risk_sev"],
        "score_points": pts, "contributions": contrib, "factor_rates": factor_rates,
    }


def profile(scores: dict, enrollment: dict | None) -> dict:
    analysis = analyze(scores)
    pricing = price(analysis, enrollment)
    return {"analysis": analysis, "pricing": pricing}


if __name__ == "__main__":
    for row in tier_table():
        print(row)
