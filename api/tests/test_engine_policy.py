"""engine.py 회귀 테스트 — 약관 게시표를 그대로 재현하는지 검증.

이 테스트가 통과하면 계리 모델이 약관과 어긋나지 않는다는 증거가 된다.
기대값 출처: policy/재수없수_교육보험_보통약관_수정본.html 별표2 · 별표3 · 별표4 · 별표7
"""
from __future__ import annotations

import math

import pytest

import engine as E

# ══════════════════════════════════════════════════════════════════════════
# 별표2 — 가입 시점별 월납 보험료 게시표 (6 시점 × 4 티어 = 24 값)
# ══════════════════════════════════════════════════════════════════════════
BYLAW2 = [
    # (잔여개월, late, θ, 라이트, 스탠다드, 플러스, 프리미엄)
    (33, 0.00, 0.240,  1_808,  3_262,  5_209,  7_622),
    (27, 0.22, 0.273,  2_257,  4_081,  6_525,  9_554),
    (21, 0.44, 0.307,  2_965,  5_373,  8_598, 12_595),
    (15, 0.67, 0.340,  4_236,  7_692, 12_322, 18_058),
    (9,  0.89, 0.373,  7_202, 13_102, 21_010, 30_806),
    (6,  1.00, 0.390, 10_912, 19_874, 31_882, 46_758),
]
TIER_ORDER = ["라이트", "스탠다드", "플러스", "프리미엄"]

# 약관 별표2 표는 θ 를 게시 소수 3자리(예: 27.3%)로 반올림해 생성된 것으로 확인됐다.
#   · late 가 딱 떨어지는 행(잔여 33·15·6개월, θ = 0.24·0.34·0.39)은 정확히 일치
#   · late 가 순환소수인 행(잔여 27·21·9개월, θ = 0.2733…·0.3066…·0.3733…)만 어긋남
# engine 은 정확 연산을 쓰므로 그 행에서 최대 7원(≤0.03%) 차이가 난다. 문서 쪽
# 반올림 아티팩트이므로, 별표2 표는 engine 출력으로 재생성해 정정하는 것이 맞다.
EXACT_THETA_MONTHS = {33, 15, 6}
DOC_ROUNDING_SLACK = 8   # 원


def _slack(remaining: int) -> int:
    return 1 if remaining in EXACT_THETA_MONTHS else DOC_ROUNDING_SLACK


@pytest.mark.parametrize("row", BYLAW2, ids=[f"{r[0]}개월" for r in BYLAW2])
def test_별표2_late_와_theta(row):
    remaining, late, theta = row[0], row[1], row[2]
    assert E.late_index(remaining) == pytest.approx(late, abs=5e-3)
    assert E.theta_for(remaining) == pytest.approx(theta, abs=5e-4)


@pytest.mark.parametrize("row", BYLAW2, ids=[f"{r[0]}개월" for r in BYLAW2])
def test_별표2_월납_게시표_24개값(row):
    remaining, _, _, *premiums = row
    slack = _slack(remaining)
    for tier, expected in zip(TIER_ORDER, premiums):
        got = E.price_for_tier(tier, remaining)["monthly_premium"]
        assert got == pytest.approx(expected, abs=slack), \
            f"{tier} @{remaining}개월: {got} != {expected}"
        # 상대오차는 어느 행에서도 0.05% 를 넘지 않아야 한다
        assert abs(got - expected) / expected < 5e-4


def test_별표2_고1_3월_기준선은_정확히_일치():
    """고1 3월 최초 가입 행은 별표4 에도 게시된 1차 기준선이므로 오차 없이 맞아야 한다."""
    for tier, expected in zip(TIER_ORDER, [1_808, 3_262, 5_209, 7_622]):
        assert E.price_for_tier(tier, 33)["monthly_premium"] == expected


def test_별표2_quote_table_가_게시표와_동일():
    for row, expected in zip(E.quote_table(), BYLAW2):
        remaining, late, theta, *premiums = expected
        assert row["remaining_months"] == remaining
        assert row["late"] == pytest.approx(late, abs=5e-3)
        assert row["theta"] == pytest.approx(theta, abs=5e-4)
        for tier, exp in zip(TIER_ORDER, premiums):
            assert row["premiums"][tier] == pytest.approx(exp, abs=_slack(remaining))


def test_가입마감은_고3_6월_모평_직전_잔여_6개월():
    assert E.MONTHS_DEADLINE == 6
    assert E.late_index(6) == 1.0
    assert E.theta_for(6) == pytest.approx(E.THETA_BASE + E.DELTA_THETA)
    # 마감 이후(잔여 6개월 미만)도 late 는 1 로 고정되어 θ 가 발산하지 않는다
    assert E.late_index(3) == 1.0


# ══════════════════════════════════════════════════════════════════════════
# 별표4 — 위험확률·보장금·EL·G·손해율·사업비율
# ══════════════════════════════════════════════════════════════════════════
BYLAW4 = [
    # (티어, 경증보장, 중증보장, EL, G, 월납, 손해율, 사업비율, 합산비율)
    ("라이트",    2_100_000,  4_200_000,  32_879,  59_671,  1_808, 0.551, 0.317, 0.868),
    ("스탠다드",  4_200_000,  8_400_000,  65_759, 107_637,  3_262, 0.611, 0.243, 0.854),
    ("플러스",    7_014_000, 14_028_000, 109_817, 171_910,  5_209, 0.639, 0.208, 0.847),
    ("프리미엄", 10_500_000, 21_000_000, 164_398, 251_533,  7_622, 0.654, 0.190, 0.844),
]


@pytest.mark.parametrize("row", BYLAW4, ids=[r[0] for r in BYLAW4])
def test_별표4_보장금과_보험료(row):
    tier, cm, cs, el, g, monthly, *_ = row
    p = E.price_for_tier(tier)
    assert p["cover_mild"] == cm
    assert p["cover_severe"] == cs
    assert p["expected_loss"] == pytest.approx(el, abs=3)
    assert p["gross_annual"] == pytest.approx(g, abs=3)
    assert p["monthly_premium"] == pytest.approx(monthly, abs=1)


@pytest.mark.parametrize("row", BYLAW4, ids=[r[0] for r in BYLAW4])
def test_별표4_손해율_사업비율_합산비율(row):
    tier, *_, loss, expense, combined = row
    r = E.premium_breakdown(tier)["ratios"]
    assert r["loss_ratio"] == pytest.approx(loss, abs=1e-3)
    assert r["expense_ratio"] == pytest.approx(expense, abs=1e-3)
    assert r["combined_ratio"] == pytest.approx(combined, abs=1e-3)


def test_별표4_사고확률():
    # 경증 0.4766% · 중증 0.5446% · 합계 1.0211%
    assert E.Q_MILD == pytest.approx(0.004766, abs=1e-6)
    assert E.Q_SEVERE == pytest.approx(0.005446, abs=1e-6)
    assert E.Q_TOTAL == pytest.approx(0.010211, abs=1e-6)
    assert E.P_MILD + E.P_SEVERE == pytest.approx(0.035398, abs=1e-6)


def test_별표4_요율식_파라미터():
    assert (E.THETA_BASE, E.F_FIXED, E.C_COMMISSION, E.V_VARIABLE) == (0.24, 9950, 0.12, 0.03)
    assert E.COVER_RATE == 0.70
    assert (E.MILD_MONTHS, E.SEVERE_MONTHS) == (6, 12)
    assert E.MONTHS_FIRST == 33


# ══════════════════════════════════════════════════════════════════════════
# 결정 1 — 보험료 구성 분해가 정확히 닫히는가
# ══════════════════════════════════════════════════════════════════════════
@pytest.mark.parametrize("tier", TIER_ORDER)
@pytest.mark.parametrize("remaining", [33, 27, 21, 15, 9, 6])
def test_구성_3분해의_합이_영업보험료와_같다(tier, remaining):
    bd = E.premium_breakdown(tier, remaining)
    c = bd["components"]
    total = c["risk_premium"] + c["expense"] + c["risk_margin"]
    assert total == pytest.approx(bd["gross_annual"], abs=2)

    r = bd["ratios"]
    assert r["loss_ratio"] + r["expense_ratio"] + r["risk_margin_ratio"] == pytest.approx(1.0, abs=2e-4)
    # 손해율은 경증·중증 기여로 정확히 재분해된다
    assert bd["loss_ratio_split"]["mild"] + bd["loss_ratio_split"]["severe"] == pytest.approx(
        r["loss_ratio"], abs=2e-4)


@pytest.mark.parametrize("tier", TIER_ORDER)
def test_월별_구성의_합이_월납과_같다(tier):
    bd = E.premium_breakdown(tier)
    m = bd["monthly_components"]
    assert m["risk_premium"] + m["expense"] + m["risk_margin"] == pytest.approx(
        bd["monthly_premium"], abs=2)


def test_위험마진은_EL곱theta와_같다():
    for tier in TIER_ORDER:
        for remaining in (33, 15, 6):
            bd = E.premium_breakdown(tier, remaining)
            expected = bd["components"]["risk_premium"] * bd["theta"]
            assert bd["components"]["risk_margin"] == pytest.approx(expected, abs=2)


def test_스탠다드_구성_분해_문서화값():
    """계획서에 실은 예시값 — 위험보험료 1,993 + 사업비 791 + 위험마진 478 = 3,262원."""
    m = E.premium_breakdown("스탠다드")["monthly_components"]
    assert m["risk_premium"] == pytest.approx(1_993, abs=1)
    assert m["expense"] == pytest.approx(791, abs=1)
    assert m["risk_margin"] == pytest.approx(478, abs=1)


def test_늦은가입_할증분은_최초가입에서_0이고_마감에서_최대():
    assert E.premium_breakdown("스탠다드", 33)["late_surcharge"] == 0
    late = E.premium_breakdown("스탠다드", 6)
    assert late["late_surcharge"] == pytest.approx(
        late["components"]["risk_premium"] * E.DELTA_THETA, abs=2)


# ══════════════════════════════════════════════════════════════════════════
# 별표3 — 급락 판정 임계 (★ 결정 2)
# ══════════════════════════════════════════════════════════════════════════
def test_결정2_임계는_경증_175_중증_225():
    assert (E.Z_MILD, E.Z_SEVERE) == (-1.75, -2.25)
    assert E.SIGMA_BAND == 0.7020


@pytest.mark.parametrize("z,expected", [
    (0.5, "정상"), (-1.0, "정상"), (-1.74, "정상"),
    (-1.75, "경증"), (-2.0, "경증"), (-2.24, "경증"),
    (-2.25, "중증"), (-3.0, "중증"),
])
def test_별표3_판정구간(z, expected):
    assert E.severity_of(z) == expected


def test_z는_등급이_나빠질수록_음수():
    # 등급은 낮을수록 우수 → 실제가 예측보다 큰 등급이면 급락(음수)
    assert E.deviation_z(actual_grade=3.0, mu_hat=2.0) < 0
    assert E.deviation_z(actual_grade=1.5, mu_hat=2.0) > 0
    assert E.deviation_z(actual_grade=2.0, mu_hat=2.0) == 0
    # 정확히 1σ 하락
    assert E.deviation_z(2.0 + E.SIGMA_BAND, 2.0) == pytest.approx(-1.0)


def test_밴드하단_등급값():
    mu = 2.41
    mild, severe = E.threshold_grades(mu)
    assert mild == pytest.approx(mu + 1.75 * E.SIGMA_BAND)      # 3.639
    assert severe == pytest.approx(mu + 2.25 * E.SIGMA_BAND)    # 3.990
    assert E.severity_of(E.deviation_z(mild, mu)) == "경증"
    assert E.severity_of(E.deviation_z(severe, mu)) == "중증"


# ══════════════════════════════════════════════════════════════════════════
# 별표7 — 회차별 OLS 회귀계수
# ══════════════════════════════════════════════════════════════════════════
def test_별표7_계수():
    assert E.OLS_INTERCEPT == 0.6086
    assert len(E.OLS_COEF) == 9
    assert E.OLS_COEF["고3_9월모평"] == 0.6241     # 9회차 중 최대 설명력
    assert max(E.OLS_COEF, key=E.OLS_COEF.get) == "고3_9월모평"
    assert list(E.OLS_COEF) == E.ROUNDS


def test_예측등급_회귀식():
    # 모든 회차가 등급 3.0 이면 μ̂ = 절편 + 3.0 × Σβ
    composites = {r: 3.0 for r in E.ROUNDS}
    expected = E.OLS_INTERCEPT + 3.0 * sum(E.OLS_COEF.values())
    assert E.predicted_grade(composites) == pytest.approx(expected)


def test_최소관측회차_미달시_판정보류():
    assert E.predicted_grade({r: 3.0 for r in E.ROUNDS[:4]}) is None      # 4회
    assert E.predicted_grade({r: 3.0 for r in E.ROUNDS[:5]}) is not None  # 5회


def test_결측회차_선형보간():
    composites = {r: None for r in E.ROUNDS}
    for r in ["고1_3월", "고1_9월", "고2_6월", "고3_5월", "고3_9월모평"]:
        composites[r] = 3.0
    mu = E.predicted_grade(composites)
    # 전부 3.0 으로 보간되므로 전 회차 3.0 과 같아야 한다
    assert mu == pytest.approx(E.OLS_INTERCEPT + 3.0 * sum(E.OLS_COEF.values()))


# ══════════════════════════════════════════════════════════════════════════
# 결정 3 — 탐구 편입 (4과목)
# ══════════════════════════════════════════════════════════════════════════
def test_결정3_탐구가_판정과_요율에_포함된다():
    assert E.INCLUDE_INQUIRY is True
    w = E.subject_weights()
    assert set(w) == {"국어", "수학", "영어", "탐구"}
    assert sum(w.values()) == pytest.approx(1.0)


def test_4과목_비중은_약관_국수영_상대비를_보존한다():
    w = E.subject_weights()
    assert w["국어"] == pytest.approx(0.2558, abs=1e-4)
    assert w["수학"] == pytest.approx(0.2745, abs=1e-4)
    assert w["영어"] == pytest.approx(0.2198, abs=1e-4)
    assert w["탐구"] == pytest.approx(0.2500, abs=1e-4)
    # 국:수:영 상대비가 약관 별표3(0.341:0.366:0.293)과 동일
    base = E.SUBJECT_WEIGHTS_BASE
    assert w["수학"] / w["국어"] == pytest.approx(base["수학"] / base["국어"])
    assert w["영어"] / w["국어"] == pytest.approx(base["영어"] / base["국어"])


def test_선언조합_재정규화():
    # 별표6 방식 — 선언한 과목만으로 비중 재정규화
    w3 = E.subject_weights(["국어", "수학", "영어"])
    assert w3 == pytest.approx(E.SUBJECT_WEIGHTS_BASE, abs=1e-4)
    w2 = E.subject_weights(["국어", "수학"])
    assert sum(w2.values()) == pytest.approx(1.0)
    assert w2["국어"] == pytest.approx(0.482, abs=1e-3)   # 별표6 국어+수학 게시값
    assert w2["수학"] == pytest.approx(0.518, abs=1e-3)


def test_종합등급_가중합():
    grades = {"국어": 2.0, "수학": 3.0, "영어": 4.0, "탐구": 1.0}
    w = E.subject_weights()
    expected = sum(w[s] * grades[s] for s in w)
    assert E.composite_grade(grades) == pytest.approx(expected)


def test_결측과목이_있어도_스케일이_유지된다():
    # 전 과목 3등급인데 탐구가 결측이면 종합도 3등급이어야 한다
    assert E.composite_grade({"국어": 3.0, "수학": 3.0, "영어": 3.0}) == pytest.approx(3.0)


def test_sigma가_잠정값임을_응답이_표시한다():
    scores = _fake_scores()
    assert E.analyze(scores)["band"]["sigma_provisional"] is True


# ══════════════════════════════════════════════════════════════════════════
# 스코어카드 (별표4 · 노트북 CELL 47·49·65·79)
# ══════════════════════════════════════════════════════════════════════════
def test_스코어카드_계수():
    assert E.SC_INTERCEPT == pytest.approx(-4.521783)
    assert E.SC_COEF["가구소득"] == pytest.approx(0.393307)
    assert E.SC_COEF["학원밀집도지수"] == pytest.approx(0.197583)
    assert E.SC_COEF["월교육비"] == pytest.approx(0.151292)
    assert (E.DELTA_A_MILD, E.DELTA_A_SEVERE) == (-0.0366, 0.2378)


def test_노트북_채점표_예시_로짓():
    """CELL 49: 가구소득 3분위(600만원) + 밀집도 2단계 + 월교육비 3분위(60만원)
       → 로짓 합계 −0.9881 → R = 0.2713"""
    e = {"household_income_manwon": 600, "academy_density_index": 2,
         "monthly_edu_cost_manwon": 60}
    R, points = E.scorecard_R(e)
    assert points["가구소득"] == pytest.approx(2.5166, abs=1e-3)
    assert points["학원밀집도지수"] == pytest.approx(0.3952, abs=1e-3)
    assert points["월교육비"] == pytest.approx(0.6219, abs=1e-3)
    assert R == pytest.approx(0.2713, abs=1e-3)


@pytest.mark.parametrize("income,logit_r,R,cond_mild,cond_severe,q", [
    # 노트북 CELL 79 — 밀집도 2 · 월교육비 60만원 고정, 소득만 변화
    (400, -1.1472, 0.2410, 0.2344, 0.2871, 0.009176),
    (500, -1.0596, 0.2574, 0.2504, 0.3054, 0.009781),
    (700, -0.9275, 0.2834, 0.2760, 0.3341, 0.010739),
])
def test_노트북_개인별_총위험확률_3인_예시(income, logit_r, R, cond_mild, cond_severe, q):
    e = {"household_income_manwon": income, "academy_density_index": 2,
         "monthly_edu_cost_manwon": 60}
    got_R, _ = E.scorecard_R(e)
    assert got_R == pytest.approx(R, abs=1e-3)
    m, s = E.conditional_retake(got_R)
    assert m == pytest.approx(cond_mild, abs=1e-3)
    assert s == pytest.approx(cond_severe, abs=1e-3)
    assert E.P_MILD * m + E.P_SEVERE * s == pytest.approx(q, abs=2e-5)


def test_로짓시프트는_순서를_보존한다():
    Rs = [0.10, 0.25, 0.50, 0.75]
    mild = [E.conditional_retake(r)[0] for r in Rs]
    severe = [E.conditional_retake(r)[1] for r in Rs]
    assert mild == sorted(mild)
    assert severe == sorted(severe)
    # 중증 시프트가 양수이므로 항상 경증보다 크다 (심도 단조성)
    assert all(s > m for m, s in zip(mild, severe))


def test_지역규모_학원밀집도_매핑():
    """결정 A — 프론트 선택지를 약관 원자료 체계(특별시/대도시/중소도시/읍면)로."""
    assert E.density_index("특별시") == 4
    assert E.density_index("대도시") == 3
    assert E.density_index("중소도시") == 2
    assert E.density_index("읍면지역") == 1
    assert E.density_index(None) == E.ACADEMY_DENSITY[E.DEFAULT_REGION]
    assert E.density_index("서울 학군지") == E.ACADEMY_DENSITY[E.DEFAULT_REGION]  # 미지정값 폴백
    assert [c["density"] for c in E.REGION_CHOICES] == [4, 3, 2, 1]


def test_요율_산포가_상한_43배_이내():
    """별표4 '요율 산포(최고÷최저) 4.3배'. R 산포가 아니라 보험료 산포다 —
    정액 사업비 F 가 산포를 압축하므로 보험료 산포 < R 산포."""
    for tier in TIER_ORDER:
        for remaining in (33, 15, 6):
            s = E.premium_spread(tier, remaining)
            assert s["high"] > s["low"]
            assert s["within_cap"], f"{tier} @{remaining}개월 산포 {s['spread']}배"
            assert s["spread"] <= E.PREMIUM_SPREAD_CAP


def test_요율지표가_입력범위로_클램프된다():
    """'배수는 4.3배로 제한된다'(별표4)는 강제이므로 범위 밖 입력을 잘라낸다."""
    inside = E.scorecard_R({"household_income_manwon": 2_000, "academy_density_index": 4,
                            "monthly_edu_cost_manwon": 300})[0]
    absurd = E.scorecard_R({"household_income_manwon": 9_950, "academy_density_index": 9,
                            "monthly_edu_cost_manwon": 5_000})[0]
    assert absurd == inside

    floor_ = E.scorecard_R({"household_income_manwon": 100, "academy_density_index": 1,
                            "monthly_edu_cost_manwon": 5})[0]
    below = E.scorecard_R({"household_income_manwon": 0, "academy_density_index": 0,
                           "monthly_edu_cost_manwon": 0})[0]
    assert below == floor_


def test_R은_입력범위_안에서_단조증가():
    base = {"academy_density_index": 2, "monthly_edu_cost_manwon": 60}
    Rs = [E.scorecard_R({**base, "household_income_manwon": v})[0]
          for v in (200, 400, 600, 900, 1_500)]
    assert Rs == sorted(Rs)


def test_성적은_스코어카드에_들어가지_않는다():
    """순환논리 방지 (약관 제22조·별표4) — 성적을 바꿔도 R 이 변하지 않아야 한다."""
    e = {"household_income_manwon": 500, "academy_density_index": 3,
         "monthly_edu_cost_manwon": 60}
    R1, _ = E.scorecard_R(e)
    R2, _ = E.scorecard_R({**e, "volatility": 99, "trend": -9, "retake_intent": 5,
                           "target_gap": "far"})
    assert R1 == R2


# ══════════════════════════════════════════════════════════════════════════
# 개인화 파이프라인
# ══════════════════════════════════════════════════════════════════════════
def _fake_scores(percentile: float = 84.0, subjects=("국어", "수학", "영어", "탐구")) -> dict:
    """서비스 단위는 백분위다. 84%ile ≈ 3등급."""
    return {
        s: [{"seq": i + 1, "label": r, "percentile": percentile}
            for i, r in enumerate(E.ROUNDS)]
        for s in subjects
    }


def test_profile_구조():
    p = E.profile(_fake_scores(), {"tier": "스탠다드", "household_income_manwon": 500,
                                   "academy_density_index": 3,
                                   "monthly_edu_cost_manwon": 60})
    assert p["analysis"]["renewable"] is True
    assert p["analysis"]["observed_rounds"] == 9
    assert set(p["analysis"]["judged_subjects"]) == {"국어", "수학", "영어", "탐구"}
    assert p["pricing"]["monthly_premium"] > 0
    assert "breakdown" in p["pricing"]


def test_개인화가_보험료를_움직인다():
    scores = _fake_scores()
    low = E.price({"tier": "스탠다드", "household_income_manwon": 300,
                   "academy_density_index": 1, "monthly_edu_cost_manwon": 20})
    high = E.price({"tier": "스탠다드", "household_income_manwon": 1000,
                    "academy_density_index": 4, "monthly_edu_cost_manwon": 150})
    assert high["monthly_premium"] > low["monthly_premium"]
    # 포트폴리오 기준선은 둘 사이에 있다
    base = E.price_for_tier("스탠다드")["monthly_premium"]
    assert low["monthly_premium"] < base < high["monthly_premium"]


def test_가입시점이_늦으면_월납이_오른다():
    e = {"tier": "스탠다드", "household_income_manwon": 500,
         "academy_density_index": 3, "monthly_edu_cost_manwon": 60}
    months = [33, 27, 21, 15, 9, 6]
    premiums = [E.price(e, m)["monthly_premium"] for m in months]
    assert premiums == sorted(premiums)
    # 보장금은 가입 시점과 무관하게 동일 (별표2 ※)
    covers = {E.price(e, m)["cover_severe"] for m in months}
    assert len(covers) == 1


def test_요율지표는_공개필드에_없다():
    p = E.price({"tier": "스탠다드", "household_income_manwon": 500})
    public = {k for k in p if not k.startswith("_")}
    assert "_score_points" in p           # 내부용은 밑줄 접두사
    for key in public:
        assert "income" not in key.lower()
        assert "density" not in key.lower()


# ══════════════════════════════════════════════════════════════════════════
# 보장대상 판정
# ══════════════════════════════════════════════════════════════════════════
def test_eligibility_판정전():
    r = E.eligibility(_fake_scores(), {"tier": "스탠다드"})
    assert r["status"] == "pending"
    assert r["cover_mild"] == 4_200_000
    assert r["cover_severe"] == 8_400_000


def test_eligibility_회차부족():
    scores = {s: [{"seq": 1, "label": "고1_3월", "percentile": 84.0}] for s in ("국어", "수학")}
    r = E.eligibility(scores, {"tier": "스탠다드"})
    assert r["status"] == "insufficient_data"
    assert r["required_rounds"] == 5


@pytest.mark.parametrize("delta_sigma,expected", [
    (0.0, "none"), (1.0, "none"), (1.74, "none"),
    (1.75, "mild"), (2.0, "mild"), (2.24, "mild"),
    (2.25, "severe"), (3.0, "severe"),
])
def test_eligibility_심각도_판정(delta_sigma, expected):
    """임계는 등급 단위(σ)로 정의돼 있다 — 등급으로 직접 넣어 경계를 검증한다."""
    scores = _fake_scores()
    mu = E.analyze(scores)["band"]["predicted_grade"]
    actual = mu + delta_sigma * E.SIGMA_BAND      # 등급이 커질수록 나쁨
    r = E.eligibility(scores, {"tier": "스탠다드"}, actual_grade=actual)
    assert r["status"] == "determined"
    assert r["result"] == expected
    assert r["eligible"] is (expected != "none")


def test_eligibility_백분위_입력():
    """서비스는 백분위로 판정을 요청한다 — 등급으로 환산돼 같은 결과가 나와야 한다."""
    scores = _fake_scores()
    band = E.analyze(scores)["band"]
    mu_g = band["predicted_grade"]
    for delta, expected in [(0.0, "none"), (2.0, "mild"), (2.5, "severe")]:
        grade = mu_g + delta * E.SIGMA_BAND
        pct = E.grade_to_percentile(grade)
        by_pct = E.eligibility(scores, {"tier": "스탠다드"}, actual_percentile=pct)
        by_grade = E.eligibility(scores, {"tier": "스탠다드"}, actual_grade=grade)
        assert by_pct["result"] == by_grade["result"] == expected
        assert by_pct["unit"] == "percentile"
        assert by_pct["actual_percentile"] == pytest.approx(pct, abs=0.1)


def test_백분위_등급_왕복():
    for g in [1.0, 2.5, 4.0, 5.5, 7.0, 8.5, 9.0]:
        assert E.percentile_to_grade(E.grade_to_percentile(g)) == pytest.approx(g, abs=1e-3)


def test_백분위가_높을수록_좋은_등급():
    grades = [E.percentile_to_grade(p) for p in [10, 30, 50, 70, 90, 99]]
    assert grades == sorted(grades, reverse=True)   # 백분위↑ → 등급↓(우수)
    assert E.percentile_to_grade(100) == 1.0
    assert E.percentile_to_grade(0) == 9.0


def test_분석_출력이_백분위_단위():
    a = E.analyze(_fake_scores(84.0))
    assert a["unit"] == "percentile"
    assert a["subjects"]["국어"]["unit"] == "percentile"
    assert a["subjects"]["국어"]["series"][0] == pytest.approx(84.0, abs=0.1)
    b = a["band"]
    assert b["predicted_percentile"] is not None
    assert b["sigma_unit"] == "grade"      # σ 는 등급 단위로 남는다 (별표3)
    # 하단은 예측보다 낮은 백분위여야 한다
    assert b["mild_threshold_percentile"] < b["predicted_percentile"]
    assert b["severe_threshold_percentile"] < b["mild_threshold_percentile"]


def test_eligibility_보장한도가_심각도에_따라_차등():
    scores = _fake_scores()
    mu = E.analyze(scores)["band"]["predicted_grade"]
    none_ = E.eligibility(scores, {"tier": "플러스"}, actual_grade=mu)
    mild = E.eligibility(scores, {"tier": "플러스"}, actual_grade=mu + 2.0 * E.SIGMA_BAND)
    severe = E.eligibility(scores, {"tier": "플러스"}, actual_grade=mu + 2.5 * E.SIGMA_BAND)
    assert none_["coverage_limit"] == 0
    assert mild["coverage_limit"] == 7_014_000
    assert severe["coverage_limit"] == 14_028_000


# ══════════════════════════════════════════════════════════════════════════
# 갱신 캡 (별표1 · 제25조 · 제29조)
# ══════════════════════════════════════════════════════════════════════════
def test_갱신_1회_인상_상한_20퍼센트():
    r = E.apply_renewal_cap(previous=3_262, theoretical=5_000, initial=3_262)
    assert r["applied"] == pytest.approx(3_262 * 1.20, abs=1)
    assert r["capped"] is True
    assert r["carried_forward"] > 0


def test_갱신_1회_인하_상한_25퍼센트():
    r = E.apply_renewal_cap(previous=3_262, theoretical=1_000, initial=3_262)
    assert r["applied"] == pytest.approx(3_262 * 0.75, abs=1)
    assert r["capped"] is True
    assert r["carried_forward"] == 0.0     # 인하 초과분은 이월하지 않는다


def test_갱신_누적_인상_상한_150퍼센트():
    initial = 3_262
    r = E.apply_renewal_cap(previous=int(initial * 2.4), theoretical=99_999, initial=initial)
    assert r["applied"] == pytest.approx(initial * 2.50, abs=1)


def test_갱신_상한_내에서는_이론값_그대로():
    r = E.apply_renewal_cap(previous=3_262, theoretical=3_500, initial=3_262)
    assert r["applied"] == 3_500
    assert r["capped"] is False
    assert r["change_rate"] == pytest.approx(3_500 / 3_262 - 1, abs=1e-4)


def test_갱신_단계는_3회이고_허용폭이_커진다():
    assert len(E.RENEWAL_STEPS) == 3
    bands = [s[3] for s in E.RENEWAL_STEPS]
    assert bands == sorted(bands)
    assert bands == [0.15, 0.20, 0.25]


def test_이월분이_다음회차에_반영된다():
    first = E.apply_renewal_cap(previous=3_262, theoretical=5_000, initial=3_262)
    second = E.apply_renewal_cap(previous=first["applied"], theoretical=4_000,
                                 initial=3_262, carried=first["carried_forward"])
    assert second["theoretical"] == 4_000
    assert second["applied"] > 4_000 or second["capped"]


# ══════════════════════════════════════════════════════════════════════════
# 해약환급금 (별표5)
# ══════════════════════════════════════════════════════════════════════════
def test_별표5_환급률():
    assert E.surrender_rate("가입 ~ 고2 말") == 0.70
    assert E.surrender_rate("고3 초 ~ 6월 모평 전") == 0.50
    assert E.surrender_rate("6월 모평 후 ~ 9월 모평 전") == 0.30
    assert E.surrender_rate("9월 모평(하단 확정 통지) 이후 ~ 수능 전") == 0.10
    assert E.surrender_rate("수능 이후") == 0.00


def test_별표5_환급률은_시점이_늦을수록_체감():
    rates = [r for _, r in E.SURRENDER_TABLE]
    assert rates == sorted(rates, reverse=True)
