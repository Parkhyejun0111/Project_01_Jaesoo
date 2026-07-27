"""개인화 산정 엔진 — 재수없수 교육보험 요율 (KELS2013 기반, 약관 확정판)

기준 문서 (우선순위 순):
  1. policy/재수없수_교육보험_보통약관_수정본.html  ← 단일 진실
       · 별표2 : 가입시점 늦은가입 할증(Δθ) 및 납입 구조
       · 별표3 : 성적 급락 판정 기준 (임계 −1.75σ / −2.25σ)
       · 별표4 : 위험확률 및 보험료 산출 기준 (확정 파라미터)
       · 별표6 : 수능 응시과목 선언 및 조합별 표준편차
       · 별표7 : 회차별 가중치(OLS 회귀계수)
  2. docs/actuarial/재수위험확률_데이터분석_최최최종.ipynb  ← 스코어카드 계수 a·b·Δa 출처

핵심 설계 (약관 제22조):
    위험확률_j = P(급락_j) × P(재수 | 급락_j)          j ∈ {경증, 중증}

  · P(급락_j)  — 성적만으로 판정. 밴드(9회차 OLS 회귀) 대비 표준화 이탈 z.
                 밴드를 각자에게 맞춰 그으므로 모든 피보험자에게 동일한 상수
                 (공정성 원칙, 별표4).
  · P(재수|급락_j) — 성적과 완전히 분리된 비성적 3지표 스코어카드.
                 가구소득(log) · 학원밀집도지수 · 월교육비(log).
                 성적을 스코어카드에 재투입하지 않는다 (순환논리 방지).

원칙: 엔진이 숫자를 계산하고, LLM 은 그 값을 설명만 한다.
      계수 a·b·Δa 는 임의로 조정하지 않는다 (약관 제22조 [임의 조정 금지]).
"""
from __future__ import annotations

import math

# ══════════════════════════════════════════════════════════════════════════
# ① 급락 판정 — 밴드 (약관 별표3 · 별표7)
# ══════════════════════════════════════════════════════════════════════════

Z_MILD, Z_SEVERE = -1.75, -2.25   # 경증 −1.75σ / 중증 −2.25σ (별표3 채택)

# 밴드 회귀 잔차 표준편차 (등급 단위). 학습표본 n=2,350 · R²=0.7426
SIGMA_BAND = 0.7020

# 9개 회차 (별표3 §1 · 제23조). 라벨은 DB exam_scores.exam_label 과 동일해야 한다.
ROUNDS = [
    "고1_3월", "고1_6월", "고1_9월",
    "고2_3월", "고2_6월", "고2_9월",
    "고3_5월", "고3_6월", "고3_9월모평",
]

# 별표7 — 회차별 OLS 회귀계수 (사전 배정 가중치가 아니라 데이터 추정값)
OLS_INTERCEPT = 0.6086
OLS_COEF = {
    "고1_3월": -0.0701, "고1_6월":  0.1356, "고1_9월":  0.0006,
    "고2_3월":  0.0698, "고2_6월": -0.0724, "고2_9월":  0.0555,
    "고3_5월":  0.0651, "고3_6월":  0.0603, "고3_9월모평": 0.6241,
}

MIN_OBSERVED_ROUNDS = 5   # 9회차 중 5회 미달 → 갱신 유보·직전 요율 유지 (제23조)

# ── 백분위 ↔ 등급 환산 ─────────────────────────────────────────────────────
# 서비스가 다루는 성적 단위는 **백분위**(0~100, 높을수록 우수)다. 반면 약관
# 별표3·4·7 의 밴드 회귀계수·σ(0.7020)·임계값은 전부 **등급**(1~9, 낮을수록 우수)
# 단위로 정의돼 있다. 백분위를 등급 자리에 그대로 넣으면 σ 가 무의미해져
# 게시 보험료표(별표2·별표4)가 깨진다.
#
# 그래서 입출력은 백분위로 하되, 밴드 계산 직전에만 등급으로 환산한다.
# 기준점은 수능 등급 구분 누적비율(1등급 상위 4% … 9등급)의 구간 대표 백분위이며,
# 구간 사이는 선형보간해 연속값을 만든다(회귀가 연속 예측을 내므로).
GRADE_PERCENTILE = {1: 98.0, 2: 93.0, 3: 84.0, 4: 70.0, 5: 50.0,
                    6: 30.0, 7: 16.0, 8: 7.0, 9: 2.0}
GRADE_MIN, GRADE_MAX = 1.0, 9.0
PERCENTILE_MIN, PERCENTILE_MAX = 0.0, 100.0


def grade_to_percentile(grade: float) -> float:
    """등급(1~9) → 백분위. 구간 사이는 선형보간."""
    g = min(max(float(grade), GRADE_MIN), GRADE_MAX)
    lo = int(g)
    hi = min(lo + 1, 9)
    frac = g - lo
    return round(GRADE_PERCENTILE[lo] + (GRADE_PERCENTILE[hi] - GRADE_PERCENTILE[lo]) * frac, 2)


def percentile_to_grade(percentile: float) -> float:
    """백분위(0~100) → 등급. grade_to_percentile 의 역함수(선형보간)."""
    p = min(max(float(percentile), PERCENTILE_MIN), PERCENTILE_MAX)
    if p >= GRADE_PERCENTILE[1]:
        return GRADE_MIN
    if p <= GRADE_PERCENTILE[9]:
        return GRADE_MAX
    for g in range(1, 9):
        hi_p, lo_p = GRADE_PERCENTILE[g], GRADE_PERCENTILE[g + 1]
        if lo_p <= p <= hi_p:
            span = hi_p - lo_p
            return round(g + (hi_p - p) / span, 4) if span else float(g)
    return GRADE_MAX


def _as_grade(row: dict) -> float | None:
    """성적 행에서 등급을 얻는다. 백분위가 1차 소스이고, 등급이 직접 들어오면 그대로 쓴다."""
    if row.get("percentile") is not None:
        return percentile_to_grade(row["percentile"])
    if row.get("grade") is not None:
        return float(row["grade"])
    return None

# ── 과목 반영비중 ──────────────────────────────────────────────────────────
# 약관 별표3/별표6 은 국·수·영 3과목 기준(0.341 / 0.366 / 0.293, 정시 반영비율
# 재정규화)이며, 별표6 ※ 는 "탐구는 조합별 σ 확정 전까지 판정 제외, 자체 자료
# 확보 시 편입"으로 편입 경로를 열어 둔다.
#
# 본 엔진은 탐구를 편입한 4과목 기준으로 동작한다. 비중은 별표6 의 "재정규화"
# 방식을 역방향으로 적용해 산출했다 — 국:수:영 의 상대비를 약관 그대로 보존하고,
# 탐구의 원비중을 3과목 평균(1/3)으로 두어 임의성을 최소화한 뒤 합이 1이 되도록
# 재정규화한다.
#   국 0.341 / 수 0.366 / 영 0.293 / 탐 0.3333  → 합 1.3333 → 각각 ÷ 1.3333
#   ⇒ 국 0.2558 / 수 0.2745 / 영 0.2198 / 탐 0.2500
# 탐구 비중 25.0% 는 실제 정시 반영비율 관행(20~25%) 상단에 해당한다.
#
# ★ 잠정 파라미터: KELS2013 원자료에 탐구 성적이 존재하지 않으므로(원자료 변수
#   전수 확인) 4과목 기준 σ 와 P(급락) 을 실증 재추정할 수 없다. 아래 SIGMA_BAND
#   와 P_MILD/P_SEVERE 는 3과목 확정값을 승계한 값이며, 이로써 별표4 의 게시
#   보험료표가 보존된다. 자체 계약 데이터가 축적되면 약관 제24조(파라미터 관리
#   및 재보정) 절차에 따라 재추정하고 사전 공시해야 한다.
SUBJECT_WEIGHTS_BASE = {"국어": 0.341, "수학": 0.366, "영어": 0.293}   # 별표3 확정(3과목)
INQUIRY_RAW_WEIGHT = 1 / 3          # 탐구 원비중 = 3과목 평균
INCLUDE_INQUIRY = True              # 탐구 판정·요율 편입 여부
INQUIRY_SIGMA_PROVISIONAL = True    # σ 가 3과목 승계값(잠정)임을 API 응답에 표시


def subject_weights(subjects: list[str] | None = None) -> dict[str, float]:
    """반영비중을 과목 조합에 맞춰 재정규화한다 (별표6 방식).

    subjects 를 주지 않으면 기본 조합(INCLUDE_INQUIRY 에 따라 4과목/3과목)을 쓴다.
    """
    raw = dict(SUBJECT_WEIGHTS_BASE)
    if INCLUDE_INQUIRY:
        raw["탐구"] = INQUIRY_RAW_WEIGHT
    if subjects is not None:
        raw = {s: w for s, w in raw.items() if s in subjects}
    total = sum(raw.values())
    if not total:
        return {}
    return {s: w / total for s, w in raw.items()}


# ══════════════════════════════════════════════════════════════════════════
# ② 포트폴리오 확률 (약관 별표4 · 전체표본 N=2,938)
# ══════════════════════════════════════════════════════════════════════════

# 별표4 의 확률은 모두 KELS2013 실측 '표본 건수 비율'이다. 게시된 백분율은 반올림
# 표시값이므로, 게시 보험료표를 정확히 재현하려면 건수로 계산해야 한다.
#   (게시 백분율로 계산하면 EL 이 티어당 3~8원 어긋난다 — 검산 확인)
N_SAMPLE = 2938                 # 전체 분석표본
N_MILD_BAND, N_SEVERE_BAND = 55, 49    # 급락 밴드 인원 (정상 2,834)
N_MILD_CLAIM, N_SEVERE_CLAIM = 14, 16  # 실제 사고(급락 ∧ 재수) 건수. 합 30 = 노트북 교집합 양성

P_MILD = N_MILD_BAND / N_SAMPLE          # 1.8720% — P(경증 급락)
P_SEVERE = N_SEVERE_BAND / N_SAMPLE      # 1.6678% — P(중증 급락)
R_MILD_OBS = N_MILD_CLAIM / N_MILD_BAND      # 0.2545 — P(재수 | 경증)
R_SEVERE_OBS = N_SEVERE_CLAIM / N_SEVERE_BAND  # 0.3265 — P(재수 | 중증)
BASE_RETAKE_RATE = 0.281                 # 기준 재수율

# 포트폴리오 기준선 위험확률 = P(급락_j) × P(재수|급락_j) = 사고건수_j ÷ N
#   별표4 "산출 결과 — 사고확률" 표의 0.4766% / 0.5446% / 합계 1.0211% 에 대응.
#   ※ 노트북 CELL 81 은 '개인 조건부확률의 학습셋 평균'을 써서 0.5124%/0.5497%
#     가 나오지만, 게시 보험료표(별표2·별표4)를 재현하는 정의는 아래다.
Q_MILD = N_MILD_CLAIM / N_SAMPLE      # 0.476515%
Q_SEVERE = N_SEVERE_CLAIM / N_SAMPLE  # 0.544588%
Q_TOTAL = Q_MILD + Q_SEVERE           # 1.021103% — 약 98명 중 1명

# ══════════════════════════════════════════════════════════════════════════
# ③ 스코어카드 (노트북 CELL 47·65 · 약관 별표4)
#    logit(R) = a + b1·log1p(가구소득) + b2·학원밀집도지수 + b3·log1p(월교육비)
# ══════════════════════════════════════════════════════════════════════════

SC_INTERCEPT = -4.521783
SC_COEF = {
    "가구소득": 0.393307,         # 입력은 log1p(만원)
    "학원밀집도지수": 0.197583,    # 1~4 정수
    "월교육비": 0.151292,         # 입력은 log1p(만원)
}
# 눈금 이동량 — 급락군 실측 평균 재수율에 정확히 앵커되도록 수치적으로 산출된 값
DELTA_A_MILD, DELTA_A_SEVERE = -0.0366, +0.2378

# 별표4 — "요율 산포(최고÷최저) 4.3배". 이는 R 산포가 아니라 **보험료** 산포다.
# (정액 사업비 F 가 산포를 압축하므로 보험료 산포 < R 산포)
# "제한된다"는 강제를 뜻하므로, 청약서가 받는 입력 범위를 명시적으로 클램프해
# 어떤 입력에도 산포 상한을 넘지 않게 한다. 아래 범위에서 실측 산포는 4.10배다.
PREMIUM_SPREAD_CAP = 4.3
INPUT_BOUNDS = {
    "household_income_manwon": (100, 2_000),   # 월평균 가구소득
    "academy_density_index": (1, 4),           # 정의상 1~4
    "monthly_edu_cost_manwon": (5, 300),       # 피보험자 1인 기준 월교육비
}

# 학원밀집도지수 — 지역규모를 재수 인프라 접근성 관점에서 뒤집은 대리지표(5 − 지역규모)
REGION_SCALE = {"특별시": 1, "대도시": 2, "중소도시": 3, "읍면지역": 4}
ACADEMY_DENSITY = {name: 5 - scale for name, scale in REGION_SCALE.items()}
#   특별시 4 · 대도시 3 · 중소도시 2 · 읍면지역 1
REGION_CHOICES = [
    {"value": "특별시", "label": "특별시", "desc": "서울·세종", "density": 4},
    {"value": "대도시", "label": "광역시", "desc": "부산·대구·인천·광주·대전·울산", "density": 3},
    {"value": "중소도시", "label": "중소도시", "desc": "그 외 시 지역", "density": 2},
    {"value": "읍면지역", "label": "읍·면 지역", "desc": "군 지역", "density": 1},
]
DEFAULT_REGION = "대도시"
DEFAULT_INCOME_MANWON = 500      # 학습표본 중위값
DEFAULT_EDU_COST_MANWON = 60     # 학습표본 중위값

# ══════════════════════════════════════════════════════════════════════════
# ④ 요율식 (약관 별표2 · 별표4)
#    영업보험료 G = (EL × (1 + θ(late)) + F) ÷ (1 − c − v)
# ══════════════════════════════════════════════════════════════════════════

COVER_RATE = 0.70          # 보장비율
F_FIXED = 9_950            # 정액 사업비 (계약당)
C_COMMISSION = 0.12        # 제휴 수수료 (인강 플랫폼)
V_VARIABLE = 0.03          # 변동비 (PG 2.5% + 정산·회계 0.5%)
THETA_BASE = 0.24          # 안전할증 (부트스트랩 4,000회 · 90%ile ÷ 평균 − 1)
DELTA_THETA = 0.15         # 늦은가입 추가할증 (정책 파라미터, 별표2)

MONTHS_FIRST = 33          # 고1 3월 최초 가입 시 잔여 납입개월
MONTHS_DEADLINE = 6        # 고3 6월 모평 직전 = 가입 마감 시 잔여 납입개월

MILD_MONTHS, SEVERE_MONTHS = 6, 12   # 보장 기간 (별표4 보장 배수)

# 티어: (상품명, 대상 재수 형태, 기준 월 학원비)
TIER_DEFS = [
    ("라이트", "독학재수", 500_000),
    ("스탠다드", "단과 통학", 1_000_000),
    ("플러스", "재종합학원", 1_670_000),
    ("프리미엄", "기숙학원", 2_500_000),
]

# 가입 시점별 잔여 납입개월 (별표2 게시표)
ENROLL_WINDOWS = [
    ("고1 3월 (최초)", 33),
    ("고1 9월", 27),
    ("고2 3월", 21),
    ("고2 9월", 15),
    ("고3 3월", 9),
    ("고3 6월 (모평 직전·가입 마감)", 6),
]

# ── 갱신 (약관 별표1 · 제17조 · 제25조 · 제29조) ───────────────────────────
RENEWAL_STEPS = [
    ("1차", "고2 3월", ["고1_3월", "고1_6월", "고1_9월"], 0.15),
    ("2차", "고3 3월", ["고2_3월", "고2_6월", "고2_9월"], 0.20),
    ("3차", "고3 9월", ["고3_5월", "고3_6월", "고3_9월모평"], 0.25),
]
CAP_INCREASE_ONCE = 0.20         # 1회 인상 상한 +20%
CAP_DECREASE_ONCE = 0.25         # 1회 인하 상한 −25%
CAP_INCREASE_CUMULATIVE = 1.50   # 누적 인상 상한 = 최초 보험료 대비 +150%

# ── 해약환급금 (약관 별표5, 표준형) ────────────────────────────────────────
SURRENDER_TABLE = [
    ("가입 ~ 고2 말", 0.70),
    ("고3 초 ~ 6월 모평 전", 0.50),
    ("6월 모평 후 ~ 9월 모평 전", 0.30),
    ("9월 모평(하단 확정 통지) 이후 ~ 수능 전", 0.10),
    ("수능 이후", 0.00),
]
SURRENDER_NO_REFUND_DISCOUNT = (0.20, 0.30)   # 무(저)해약환급금형 보험료 할인폭


# ══════════════════════════════════════════════════════════════════════════
# 헬퍼
# ══════════════════════════════════════════════════════════════════════════

def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def _logit(p: float) -> float:
    p = min(max(p, 1e-6), 1 - 1e-6)
    return math.log(p / (1 - p))


def covers(monthly_cost: int) -> tuple[int, int]:
    """(경증 보장금, 중증 보장금) — 월 학원비 × 보장기간 × 보장비율."""
    return (
        round(monthly_cost * MILD_MONTHS * COVER_RATE),
        round(monthly_cost * SEVERE_MONTHS * COVER_RATE),
    )


def late_index(remaining_months: int) -> float:
    """가입 늦음 정도 late ∈ [0, 1] (별표2).

    late = 1 − (잔여 − 마감월잔여) ÷ (최초잔여 − 마감월잔여)
    고1 3월(잔여 33) → 0 · 고3 6월 모평 직전(잔여 6) → 1
    """
    span = MONTHS_FIRST - MONTHS_DEADLINE
    raw = 1 - (remaining_months - MONTHS_DEADLINE) / span
    return min(max(raw, 0.0), 1.0)


def theta_for(remaining_months: int) -> float:
    """θ(가입시점) = θ_base + Δθ · late (별표2)."""
    return THETA_BASE + DELTA_THETA * late_index(remaining_months)


def _gross(el: float, remaining_months: int) -> tuple[float, float]:
    """기대손실 → (연 영업보험료 G, 월납). 반올림하지 않은 원시값."""
    theta = theta_for(remaining_months)
    g = (el * (1 + theta) + F_FIXED) / (1 - C_COMMISSION - V_VARIABLE)
    return g, g / remaining_months


def _tier(tier_name: str) -> tuple[str, str, int]:
    return next((t for t in TIER_DEFS if t[0] == tier_name), TIER_DEFS[1])


def _slope(xs: list[float]) -> float:
    """단순 선형 추세. 등급 기준이므로 음수 = 성적 향상."""
    n = len(xs)
    if n < 2:
        return 0.0
    mx = (n - 1) / 2
    my = sum(xs) / n
    num = sum((i - mx) * (xs[i] - my) for i in range(n))
    den = sum((i - mx) ** 2 for i in range(n))
    return num / den if den else 0.0


# ══════════════════════════════════════════════════════════════════════════
# 성적 분석 — 밴드·급락 판정
# ══════════════════════════════════════════════════════════════════════════

def composite_grade(round_grades: dict[str, float],
                    subjects: list[str] | None = None) -> float | None:
    """한 회차의 과목별 등급 → 반영비중 가중합 종합등급.

    관측된 과목만으로 비중을 재정규화한다(결측 과목이 있어도 스케일 유지).
    """
    weights = subject_weights(subjects)
    pairs = [(w, float(round_grades[s])) for s, w in weights.items()
             if round_grades.get(s) is not None]
    if not pairs:
        return None
    total_w = sum(w for w, _ in pairs)
    return sum(w * g for w, g in pairs) / total_w


def _interpolate(series: list[float | None]) -> list[float | None]:
    """결측 회차를 앞뒤 관측값으로 선형보간한다 (노트북 §2 표본 규칙)."""
    out = list(series)
    known = [i for i, v in enumerate(out) if v is not None]
    if not known:
        return out
    for i in range(len(out)):
        if out[i] is not None:
            continue
        prev = max((k for k in known if k < i), default=None)
        nxt = min((k for k in known if k > i), default=None)
        if prev is None:
            out[i] = out[nxt]
        elif nxt is None:
            out[i] = out[prev]
        else:
            out[i] = out[prev] + (out[nxt] - out[prev]) * (i - prev) / (nxt - prev)
    return out


def predicted_grade(round_composites: dict[str, float]) -> float | None:
    """9회차 종합등급 → 밴드 회귀 예측 수능 등급 μ̂ (별표3 ② · 별표7).

    관측 회차가 MIN_OBSERVED_ROUNDS 미달이면 None (갱신 유보, 제23조).
    """
    observed = [r for r in ROUNDS if round_composites.get(r) is not None]
    if len(observed) < MIN_OBSERVED_ROUNDS:
        return None
    filled = _interpolate([round_composites.get(r) for r in ROUNDS])
    return OLS_INTERCEPT + sum(OLS_COEF[r] * filled[i] for i, r in enumerate(ROUNDS))


def deviation_z(actual_grade: float, mu_hat: float) -> float:
    """표준화 이탈값 z = −(실제 수능 등급 − μ̂) ÷ σ (별표3 ②).

    등급은 낮을수록 우수하므로 부호를 뒤집어 음수 = 급락이 되게 한다.
    """
    return -(actual_grade - mu_hat) / SIGMA_BAND


def severity_of(z: float) -> str:
    """z → 정상 / 경증 / 중증 (별표3 §3 판정 구간)."""
    if z <= Z_SEVERE:
        return "중증"
    if z <= Z_MILD:
        return "경증"
    return "정상"


def threshold_grades(mu_hat: float) -> tuple[float, float]:
    """밴드 하단 등급값. 등급은 낮을수록 우수하므로 μ̂ 보다 큰 값이 하단이다."""
    return (mu_hat - Z_MILD * SIGMA_BAND, mu_hat - Z_SEVERE * SIGMA_BAND)


def analyze(scores: dict) -> dict:
    """DB 성적(과목별 회차 리스트) → 회차 종합등급·밴드·과목별 통계.

    scores 형태: {과목: [{"seq": 1, "label": "고1_3월", "grade": 3.2}, ...]}
    """
    by_round: dict[str, dict[str, float]] = {}
    subject_stats: dict[str, dict] = {}
    judged = set(subject_weights().keys())

    for subject, rows in (scores or {}).items():
        series: list[float] = []          # 화면·통계용 — 백분위
        for row in sorted(rows, key=lambda r: r.get("seq", 0)):
            grade = _as_grade(row)
            if grade is None:
                continue
            pct = row.get("percentile")
            series.append(float(pct) if pct is not None else grade_to_percentile(grade))
            label = row.get("label")
            if label in OLS_COEF and subject in judged:
                # 밴드 회귀는 등급 단위로만 성립한다 (별표7 계수·σ 가 등급 기준)
                by_round.setdefault(label, {})[subject] = grade
        if series:
            mean = sum(series) / len(series)
            var = (sum((x - mean) ** 2 for x in series) / len(series)) if len(series) > 1 else 0.0
            subject_stats[subject] = {
                "series": [round(x, 1) for x in series],
                "mean": round(mean, 1),
                "volatility": round(math.sqrt(var), 1),
                "trend": round(_slope(series), 2),
                "latest": round(series[-1], 1),
                "judged": subject in judged,
                "unit": "percentile",
            }

    composites = {r: composite_grade(g) for r, g in by_round.items()}
    mu_hat = predicted_grade(composites)
    observed = sum(1 for r in ROUNDS if composites.get(r) is not None)

    if mu_hat is None:
        mild_grade = severe_grade = None
    else:
        mild_grade, severe_grade = threshold_grades(mu_hat)

    # 기복이 큰 과목 = 변동성이 크고 추세가 나쁜 순.
    # 백분위는 '오를수록 좋음' 이므로 추세가 음수일 때 위험하다 (등급과 부호 반대).
    weak = sorted(
        ({"subject": s, "volatility": v["volatility"], "trend": v["trend"],
          "risk_score": round(v["volatility"] - v["trend"] * 3, 2)}
         for s, v in subject_stats.items()),
        key=lambda x: -x["risk_score"],
    )

    return {
        "subjects": subject_stats,
        "weak_subjects": weak,
        # 회차 종합 성적 — 화면용 백분위 (내부 밴드 계산은 등급으로 한다)
        "rounds": {r: (grade_to_percentile(c) if c is not None else None)
                   for r, c in composites.items()},
        "rounds_grade": {r: (round(c, 3) if c is not None else None)
                         for r, c in composites.items()},
        "unit": "percentile",
        "round_order": ROUNDS,
        "observed_rounds": observed,
        "renewable": mu_hat is not None,
        "band": {
            # 화면이 쓰는 단위는 백분위. 등급 값은 계리 근거 확인용으로 함께 준다.
            "predicted_percentile": grade_to_percentile(mu_hat) if mu_hat is not None else None,
            "mild_threshold_percentile": grade_to_percentile(mild_grade) if mild_grade is not None else None,
            "severe_threshold_percentile": grade_to_percentile(severe_grade) if severe_grade is not None else None,
            "predicted_grade": round(mu_hat, 3) if mu_hat is not None else None,
            "mild_threshold_grade": round(mild_grade, 3) if mild_grade is not None else None,
            "severe_threshold_grade": round(severe_grade, 3) if severe_grade is not None else None,
            "sigma": SIGMA_BAND,
            "sigma_unit": "grade",
            "sigma_provisional": INQUIRY_SIGMA_PROVISIONAL and INCLUDE_INQUIRY,
            "z_mild": Z_MILD,
            "z_severe": Z_SEVERE,
        },
        "judged_subjects": sorted(judged),
        "subject_weights": {s: round(w, 4) for s, w in subject_weights().items()},
    }


# ══════════════════════════════════════════════════════════════════════════
# 스코어카드 — 개인 점수 R 과 심각도별 조건부 재수확률
# ══════════════════════════════════════════════════════════════════════════

def density_index(region: str | None) -> int:
    """지역규모 명칭 → 학원밀집도지수 (특별시 4 ~ 읍면지역 1)."""
    return ACADEMY_DENSITY.get(region or DEFAULT_REGION,
                               ACADEMY_DENSITY[DEFAULT_REGION])


def _clamp(field: str, value: float) -> float:
    """요율 지표를 청약서 입력 범위로 클램프 (요율 산포 상한 강제, 별표4)."""
    lo, hi = INPUT_BOUNDS[field]
    return min(max(value, lo), hi)


def scorecard_inputs(enrollment: dict | None) -> dict[str, float]:
    """청약서 요율 3문항 → 스코어카드 입력 (소득·교육비는 log1p(만원))."""
    e = enrollment or {}
    income = e.get("household_income_manwon")
    edu = e.get("monthly_edu_cost_manwon")
    income = DEFAULT_INCOME_MANWON if income in (None, "") else float(income)
    edu = DEFAULT_EDU_COST_MANWON if edu in (None, "") else float(edu)
    idx = e.get("academy_density_index")
    if idx in (None, ""):
        idx = density_index(e.get("region"))
    return {
        "가구소득": math.log1p(_clamp("household_income_manwon", income)),
        "학원밀집도지수": _clamp("academy_density_index", float(idx)),
        "월교육비": math.log1p(_clamp("monthly_edu_cost_manwon", edu)),
    }


def _edge_expected_loss(tier_name: str, pick: int) -> float:
    """입력 범위 양끝(pick 0=최저, 1=최고) 계약자의 기대손실."""
    e = {f: INPUT_BOUNDS[f][pick] for f in INPUT_BOUNDS}
    R, _ = scorecard_R(e)
    r_mild, r_severe = conditional_retake(R)
    cover_mild, cover_severe = covers(_tier(tier_name)[2])
    return P_MILD * r_mild * cover_mild + P_SEVERE * r_severe * cover_severe


def _baseline_expected_loss(tier_name: str) -> float:
    cover_mild, cover_severe = covers(_tier(tier_name)[2])
    return Q_MILD * cover_mild + Q_SEVERE * cover_severe


_COMPRESSION_CACHE: dict[tuple[str, int], float] = {}


def compression_factor(tier_name: str, remaining_months: int) -> float:
    """요율 산포를 상한(4.3배) 이내로 누르는 압축계수 λ ∈ (0, 1] (별표4).

    개인 기대손실을 기준선 쪽으로 λ 만큼 끌어당긴다:
        EL' = EL_base + λ · (EL_i − EL_base)
    λ=1 이면 압축 없음. 순서(요율 서열)는 보존되고 기준선은 이동하지 않는다.
    정액 사업비 F 때문에 압축 필요량이 티어·가입시점마다 달라 개별로 구한다.
    """
    key = (tier_name, remaining_months)
    if key in _COMPRESSION_CACHE:
        return _COMPRESSION_CACHE[key]

    base = _baseline_expected_loss(tier_name)
    lo = _edge_expected_loss(tier_name, 0)
    hi = _edge_expected_loss(tier_name, 1)

    def spread(lam: float) -> float:
        # 실제 청구되는 값은 원 단위로 반올림된 월납이므로 그 비율로 상한을 판정한다
        p_lo = round(_gross(base + lam * (lo - base), remaining_months)[1])
        p_hi = round(_gross(base + lam * (hi - base), remaining_months)[1])
        return p_hi / p_lo if p_lo else 1.0

    if spread(1.0) <= PREMIUM_SPREAD_CAP:
        _COMPRESSION_CACHE[key] = 1.0
        return 1.0

    # spread(λ) 는 λ 에 대해 단조증가하고 spread(0)=1 이므로 이분탐색이 성립한다
    low, high = 0.0, 1.0
    for _ in range(80):
        mid = (low + high) / 2
        if spread(mid) > PREMIUM_SPREAD_CAP:
            high = mid
        else:
            low = mid
    _COMPRESSION_CACHE[key] = low
    return low


def _compress(el: float, tier_name: str, remaining_months: int) -> float:
    """개인 기대손실에 요율 산포 상한을 적용한다."""
    lam = compression_factor(tier_name, remaining_months)
    if lam >= 1.0:
        return el
    base = _baseline_expected_loss(tier_name)
    return base + lam * (el - base)


def premium_spread(tier_name: str = "스탠다드",
                   remaining_months: int = MONTHS_FIRST) -> dict:
    """입력 범위 양끝의 월납 비율 = 요율 산포 (별표4 '최고÷최저 4.3배')."""
    edges = {}
    for key, pick in (("low", 0), ("high", 1)):
        e = {"tier": tier_name, **{f: INPUT_BOUNDS[f][pick] for f in INPUT_BOUNDS}}
        edges[key] = price(e, remaining_months)["monthly_premium"]
    spread = edges["high"] / edges["low"]
    return {
        "low": edges["low"], "high": edges["high"],
        "spread": round(spread, 3),
        "cap": PREMIUM_SPREAD_CAP,
        "compression": round(compression_factor(tier_name, remaining_months), 4),
        "within_cap": spread <= PREMIUM_SPREAD_CAP,
    }


def scorecard_R(enrollment: dict | None) -> tuple[float, dict]:
    """logit(R) = a + b·X → 개인 점수 R (밴드와 무관한 재수확률).

    반환: (R, 지표별 배점(로그오즈 기여))
    """
    x = scorecard_inputs(enrollment)
    points = {k: round(SC_COEF[k] * x[k], 4) for k in SC_COEF}
    return round(_sigmoid(SC_INTERCEPT + sum(points.values())), 6), points


def conditional_retake(R: float) -> tuple[float, float]:
    """개인 R → (P(재수|경증), P(재수|중증)) — 로짓 시프트 (별표4)."""
    z = _logit(R)
    return _sigmoid(z + DELTA_A_MILD), _sigmoid(z + DELTA_A_SEVERE)


def scorecard_table() -> list[dict]:
    """채점표 — 구간별 배점(로그오즈 기여). 내부·감독 제출용(약관 별표4).

    ※ 고객 화면에는 노출하지 않는다. 요율 3지표는 SES 민감정보다.
    """
    rows: list[dict] = []
    for label, value in [("1분위 (288만원)", 288), ("2분위 (500만원)", 500),
                         ("3분위 (600만원)", 600), ("4분위 (700만원)", 700),
                         ("5분위 (1,000만원)", 1000)]:
        rows.append({"지표": "가구소득", "구간": label,
                     "배점": round(SC_COEF["가구소득"] * math.log1p(value), 4)})
    for name, idx in sorted(ACADEMY_DENSITY.items(), key=lambda kv: kv[1]):
        rows.append({"지표": "학원밀집도지수", "구간": f"{name} ({idx}단계)",
                     "배점": round(SC_COEF["학원밀집도지수"] * idx, 4)})
    for label, value in [("1분위 (20만원)", 20), ("2분위 (45만원)", 45),
                         ("3분위 (60만원)", 60), ("4분위 (90만원)", 90),
                         ("5분위 (150만원)", 150)]:
        rows.append({"지표": "월교육비", "구간": label,
                     "배점": round(SC_COEF["월교육비"] * math.log1p(value), 4)})
    return rows


# ══════════════════════════════════════════════════════════════════════════
# 보험료 산출
# ══════════════════════════════════════════════════════════════════════════

def price_for_tier(tier_name: str,
                   remaining_months: int = MONTHS_FIRST,
                   q_mild: float = Q_MILD,
                   q_severe: float = Q_SEVERE) -> dict:
    """티어 × 가입시점 → 기대손실·영업보험료·월납.

    q_mild/q_severe 를 주지 않으면 포트폴리오 기준선(별표4)을 쓴다.
    개인화는 conditional_retake() 로 구한 개인 조건부확률을 넘겨서 한다.
    """
    name, form, monthly_cost = _tier(tier_name)
    cover_mild, cover_severe = covers(monthly_cost)
    el_mild = q_mild * cover_mild
    el_severe = q_severe * cover_severe
    el = el_mild + el_severe
    gross, monthly = _gross(el, remaining_months)
    return {
        "tier": name, "form": form, "monthly_cost": monthly_cost,
        "cover_mild": cover_mild, "cover_severe": cover_severe,
        "risk_mild": round(q_mild, 7), "risk_severe": round(q_severe, 7),
        "risk_total": round(q_mild + q_severe, 7),
        "expected_loss": round(el),
        "expected_loss_mild": round(el_mild),
        "expected_loss_severe": round(el_severe),
        "gross_annual": round(gross), "monthly_premium": round(monthly),
        "remaining_months": remaining_months,
        "late": round(late_index(remaining_months), 4),
        "theta": round(theta_for(remaining_months), 4),
    }


def premium_breakdown(tier_name: str,
                      remaining_months: int = MONTHS_FIRST,
                      q_mild: float = Q_MILD,
                      q_severe: float = Q_SEVERE) -> dict:
    """영업보험료를 위험보험료·사업비·위험마진으로 분해 (약관 별표4).

    세 항의 합은 정확히 G 이고, 손해율 + 사업비율 + 위험마진율 = 100% 다.
    손해율은 경증·중증 기여로 정확히 재분해된다(가상 시나리오가 아니라 기여도 분해).
    """
    name, _, monthly_cost = _tier(tier_name)
    cover_mild, cover_severe = covers(monthly_cost)
    el_mild = q_mild * cover_mild
    el_severe = q_severe * cover_severe
    el = el_mild + el_severe
    gross, monthly = _gross(el, remaining_months)
    theta = theta_for(remaining_months)

    expense = F_FIXED + gross * (C_COMMISSION + V_VARIABLE)
    margin = gross - el - expense              # = EL × θ(late)
    late_surcharge = el * (theta - THETA_BASE)  # 위험마진 중 늦은가입 할증분

    def per_month(x: float) -> int:
        return round(x / remaining_months)

    return {
        "tier": name,
        "remaining_months": remaining_months,
        "late": round(late_index(remaining_months), 4),
        "theta": round(theta, 4),
        "gross_annual": round(gross),
        "monthly_premium": round(monthly),
        "components": {
            "risk_premium": round(el),
            "expense": round(expense),
            "risk_margin": round(margin),
        },
        "monthly_components": {
            "risk_premium": per_month(el),
            "expense": per_month(expense),
            "risk_margin": per_month(margin),
        },
        "ratios": {
            "loss_ratio": round(el / gross, 4),
            "expense_ratio": round(expense / gross, 4),
            "risk_margin_ratio": round(margin / gross, 4),
            "combined_ratio": round((el + expense) / gross, 4),
        },
        "loss_ratio_split": {
            "mild": round(el_mild / gross, 4),
            "severe": round(el_severe / gross, 4),
        },
        "late_surcharge": round(late_surcharge),
        "expense_detail": {
            "fixed": F_FIXED,
            "commission": round(gross * C_COMMISSION),
            "variable": round(gross * V_VARIABLE),
        },
        "coverage": {"mild": cover_mild, "severe": cover_severe},
    }


def tier_table(remaining_months: int = MONTHS_FIRST,
               q_mild: float = Q_MILD,
               q_severe: float = Q_SEVERE) -> list[dict]:
    """티어 선택 화면용 표 (별표4 '고객용 상품안내표')."""
    rows = []
    for name, form, monthly_cost in TIER_DEFS:
        p = price_for_tier(name, remaining_months, q_mild, q_severe)
        rows.append({
            "tier": name, "form": form, "monthly_cost": monthly_cost,
            "cover_rate": COVER_RATE,
            "cover_mild": p["cover_mild"], "cover_severe": p["cover_severe"],
            "cover_mild_months": MILD_MONTHS, "cover_severe_months": SEVERE_MONTHS,
            "expected_loss": p["expected_loss"],
            "gross_annual": p["gross_annual"],
            "monthly_premium": p["monthly_premium"],
            "remaining_months": remaining_months,
        })
    return rows


def quote_table(q_mild: float = Q_MILD, q_severe: float = Q_SEVERE) -> list[dict]:
    """가입 시점별 월납 조견표 (별표2 게시표) — "지금 들면 얼마, 미루면 얼마"."""
    rows = []
    for label, remaining in ENROLL_WINDOWS:
        rows.append({
            "window": label,
            "remaining_months": remaining,
            "late": round(late_index(remaining), 2),
            "theta": round(theta_for(remaining), 3),
            "premiums": {
                name: price_for_tier(name, remaining, q_mild, q_severe)["monthly_premium"]
                for name, _, _ in TIER_DEFS
            },
        })
    return rows


# ══════════════════════════════════════════════════════════════════════════
# 개인화 — 프로필·판정
# ══════════════════════════════════════════════════════════════════════════

def price(enrollment: dict | None, remaining_months: int | None = None) -> dict:
    """청약서 요율 3지표 + 티어 + 가입시점 → 개인 보험료.

    개인화는 P(재수|급락) 에만 들어간다. P(급락) 은 전원 동일(공정성, 별표4).
    """
    e = enrollment or {}
    tier = e.get("tier") or "스탠다드"
    months = remaining_months or e.get("enrolled_at_remaining_months") or MONTHS_FIRST

    R, points = scorecard_R(e)
    r_mild, r_severe = conditional_retake(R)
    q_mild = P_MILD * r_mild
    q_severe = P_SEVERE * r_severe

    # 요율 산포 상한(별표4) — 심도 구성비를 유지하며 기준선 쪽으로 압축한다
    lam = compression_factor(tier, months)
    if lam < 1.0:
        cover_mild, cover_severe = covers(_tier(tier)[2])
        el_raw = q_mild * cover_mild + q_severe * cover_severe
        el_capped = _compress(el_raw, tier, months)
        scale = el_capped / el_raw if el_raw else 1.0
        q_mild *= scale
        q_severe *= scale

    p = price_for_tier(tier, months, q_mild, q_severe)
    bd = premium_breakdown(tier, months, q_mild, q_severe)

    return {
        "tier": tier,
        "remaining_months": months,
        "late": p["late"], "theta": p["theta"],
        "R": R,
        "rate_compression": round(lam, 4),
        "conditional_retake": {"mild": round(r_mild, 4), "severe": round(r_severe, 4)},
        "risk_mild": p["risk_mild"], "risk_severe": p["risk_severe"],
        "risk_prob": p["risk_total"],
        "expected_loss": p["expected_loss"],
        "gross_annual": p["gross_annual"],
        "monthly_premium": p["monthly_premium"],
        "cover_mild": p["cover_mild"], "cover_severe": p["cover_severe"],
        "coverage": p["cover_severe"],
        "breakdown": bd,
        # 내부용 — 고객 화면·챗봇에 노출하지 않는다 (요율 3지표는 SES 민감정보)
        "_score_points": points,
    }


def profile(scores: dict, enrollment: dict | None) -> dict:
    return {"analysis": analyze(scores), "pricing": price(enrollment)}


def eligibility(scores: dict, enrollment: dict | None,
                actual_percentile: float | None = None,
                actual_grade: float | None = None) -> dict:
    """보장 대상 판정 (별표3).

    실제 수능 성적은 **백분위**로 받는다(서비스 단위). 계리 판정은 등급으로
    환산해 수행한다 — σ·임계값이 등급 단위로 정의돼 있기 때문이다.
    actual_grade 로 등급을 직접 줄 수도 있다(내부·검증용).
    """
    if actual_grade is None and actual_percentile is not None:
        actual_grade = percentile_to_grade(actual_percentile)
    analysis = analyze(scores)
    band = analysis["band"]
    mu_hat = band["predicted_grade"]
    tier = (enrollment or {}).get("tier") or "스탠다드"
    cover_mild, cover_severe = covers(_tier(tier)[2])

    common = {
        "cover_mild": cover_mild,
        "cover_severe": cover_severe,
        "judged_subjects": analysis["judged_subjects"],
        "subject_weights": analysis["subject_weights"],
        "sigma": SIGMA_BAND,
        "sigma_unit": "grade",
        "sigma_provisional": band["sigma_provisional"],
        "mild_threshold_z": Z_MILD,
        "severe_threshold_z": Z_SEVERE,
        "unit": "percentile",
    }

    if mu_hat is None:
        return {**common, "status": "insufficient_data",
                "observed_rounds": analysis["observed_rounds"],
                "required_rounds": MIN_OBSERVED_ROUNDS,
                "message": "밴드 산정에 필요한 최소 관측 회차(9회 중 5회)에 미달합니다."}

    if actual_grade is None:
        return {**common, "status": "pending",
                "predicted_percentile": band["predicted_percentile"],
                "mild_threshold_percentile": band["mild_threshold_percentile"],
                "severe_threshold_percentile": band["severe_threshold_percentile"],
                "predicted_grade": mu_hat,
                "mild_threshold_grade": band["mild_threshold_grade"],
                "severe_threshold_grade": band["severe_threshold_grade"],
                "message": "수능 성적 확정 후 판정됩니다."}

    z = deviation_z(float(actual_grade), mu_hat)
    sev = severity_of(z)
    return {**common,
            "status": "determined",
            "result": {"정상": "none", "경증": "mild", "중증": "severe"}[sev],
            "severity": sev,
            "eligible": sev != "정상",
            "predicted_percentile": band["predicted_percentile"],
            "actual_percentile": (round(float(actual_percentile), 1)
                                  if actual_percentile is not None
                                  else grade_to_percentile(actual_grade)),
            "mild_threshold_percentile": band["mild_threshold_percentile"],
            "severe_threshold_percentile": band["severe_threshold_percentile"],
            "predicted_grade": mu_hat,
            "actual_grade": round(float(actual_grade), 3),
            "z": round(z, 3),
            "mild_threshold_grade": band["mild_threshold_grade"],
            "severe_threshold_grade": band["severe_threshold_grade"],
            "coverage_limit": {"정상": 0, "경증": cover_mild, "중증": cover_severe}[sev]}


# ══════════════════════════════════════════════════════════════════════════
# 갱신 (별표1 · 제25조 · 제29조)
# ══════════════════════════════════════════════════════════════════════════

def apply_renewal_cap(previous: float, theoretical: float, initial: float,
                      carried: float = 0.0) -> dict:
    """이론 보험료에 1회·누적 상한을 적용한다.

    제25조는 "상한 적용 전 이론 보험료를 먼저 산출"하도록 정한다.
      · 1회 인상 ≤ +20% · 1회 인하 ≤ −25%
      · 누적 인상 ≤ 최초 보험료 대비 +150%
      · 상한 초과분은 다음 회차로 이월(carried, 비율)
    """
    target = theoretical * (1 + carried)
    ceiling_once = previous * (1 + CAP_INCREASE_ONCE)
    floor_once = previous * (1 - CAP_DECREASE_ONCE)
    ceiling_cum = initial * (1 + CAP_INCREASE_CUMULATIVE)

    applied = min(max(target, floor_once), ceiling_once, ceiling_cum)
    excess = target - applied
    return {
        "previous": round(previous),
        "theoretical": round(theoretical),
        "applied": round(applied),
        "capped": abs(excess) > 0.5,
        "carried_forward": round(excess / applied, 4) if applied and excess > 0.5 else 0.0,
        "limits": {
            "once_increase": round(ceiling_once),
            "once_decrease": round(floor_once),
            "cumulative_increase": round(ceiling_cum),
        },
        "change_rate": round(applied / previous - 1, 4) if previous else 0.0,
    }


def surrender_rate(stage: str) -> float:
    """해약환급률 (별표5 표준형)."""
    return dict(SURRENDER_TABLE).get(stage, 0.0)


if __name__ == "__main__":
    print(f"── 고객용 상품안내표 (고1 3월 최초 가입 · 보장률 {COVER_RATE:.0%} · 납입 {MONTHS_FIRST}개월)")
    for row in tier_table():
        print(f"  {row['tier']:<5} {row['form']:<7} "
              f"경증 {row['cover_mild']:>10,} / 중증 {row['cover_severe']:>11,} · "
              f"EL {row['expected_loss']:>7,} · G {row['gross_annual']:>8,} · "
              f"월납 {row['monthly_premium']:>6,}원")

    print(f"\n── 가입 시점별 월납 조견표 (사고확률 {Q_TOTAL:.4%})")
    for row in quote_table():
        prem = " · ".join(f"{k} {v:,}" for k, v in row["premiums"].items())
        print(f"  {row['window']:<32} 잔여 {row['remaining_months']:>2}개월 · "
              f"late {row['late']:.2f} · θ {row['theta']:.1%} · {prem}")

    print("\n── 보험료 구성 분해 (스탠다드 · 고1 3월)")
    bd = premium_breakdown("스탠다드")
    labels = [("risk_premium", "위험보험료"), ("expense", "사업비"), ("risk_margin", "위험마진")]
    for key, label in labels:
        print(f"  {label:<6} 연 {bd['components'][key]:>8,}원 · "
              f"월 {bd['monthly_components'][key]:>6,}원")
    print(f"  {'합계':<6} 연 {bd['gross_annual']:>8,}원 · 월 {bd['monthly_premium']:>6,}원 "
          f"(손해율 {bd['ratios']['loss_ratio']:.1%} + 사업비율 {bd['ratios']['expense_ratio']:.1%} "
          f"+ 위험마진 {bd['ratios']['risk_margin_ratio']:.1%})")

    print(f"\n── 과목 반영비중 (탐구 편입={INCLUDE_INQUIRY})")
    for s, w in subject_weights().items():
        print(f"  {s} {w:.4f}")
