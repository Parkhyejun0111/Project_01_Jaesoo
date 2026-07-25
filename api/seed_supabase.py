"""가상 데이터 시드 — 인강사이트에서 제공받았다고 가정한 학생/성적 + 가입 청약.

성적은 **등급 1~9(낮을수록 우수)** 로 생성한다 — 약관 별표3 의 급락 판정이 등급
가중합산 성적을 기준으로 하기 때문이다. 백분위는 화면 표시 참고용으로 함께 넣는다.

회차 라벨은 engine.ROUNDS(별표3 §1 · 별표7)와 정확히 같아야 한다:
    고1 3·6·9월 · 고2 3·6·9월 · 고3 5·6월 · 고3 9월모평   (9회)

실행:  python seed_supabase.py
멱등: 실행 시 기존 데이터를 지우고 다시 생성한다.
"""
from __future__ import annotations

import random

import db_supabase as db
import engine

EXAM_LABELS = engine.ROUNDS          # 9회차 — engine 과 단일 소스
SUBJECTS = ["국어", "수학", "영어", "탐구"]

GRADE_MIN, GRADE_MAX = 1.0, 9.0

# 학생 프로필 + 과목별 (시작 등급, 회차당 추세, 변동성)
#   trend 음수 = 등급이 낮아짐 = 성적 향상
STUDENTS = [
    {
        "student_id": "stu_jimin", "name": "김지민", "school": "목동고등학교", "grade_year": "고3",
        "track": "자연", "target_univ": "서울대학교 경영학과", "source_site": "메가스터디",
        "enroll": {
            "tier": "스탠다드", "region": "특별시",
            "household_income_manwon": 700, "monthly_edu_cost_manwon": 90,
            "enrolled_at_remaining_months": 33,
            "monthly_saving": 200, "retire_goal": 40000,
        },
        # 중상위권, 수학 기복 큼
        "subjects": {"국어": (3.4, -0.08, 0.55), "수학": (3.0, -0.12, 0.75),
                     "영어": (3.8, -0.18, 0.30), "탐구": (3.3, -0.06, 0.45)},
    },
    {
        "student_id": "stu_seojun", "name": "박서준", "school": "분당고등학교", "grade_year": "고3",
        "track": "인문", "target_univ": "연세대학교 경제학과", "source_site": "메가스터디",
        "enroll": {
            "tier": "라이트", "region": "중소도시",
            "household_income_manwon": 500, "monthly_edu_cost_manwon": 45,
            "enrolled_at_remaining_months": 27,
            "monthly_saving": 120, "retire_goal": 20000,
        },
        # 꾸준한 상승, 변동성 작음
        "subjects": {"국어": (3.2, -0.15, 0.28), "수학": (3.4, -0.17, 0.32),
                     "영어": (2.8, -0.11, 0.22), "탐구": (3.0, -0.14, 0.26)},
    },
    {
        "student_id": "stu_haeun", "name": "이하은", "school": "대전한빛고등학교", "grade_year": "고3",
        "track": "자연", "target_univ": "고려대학교 컴퓨터학과", "source_site": "메가스터디",
        "enroll": {
            "tier": "프리미엄", "region": "읍면지역",
            "household_income_manwon": 300, "monthly_edu_cost_manwon": 20,
            "enrolled_at_remaining_months": 21,
            "monthly_saving": 60, "retire_goal": 15000,
        },
        # 중위권, 기복 매우 큼 (급락 위험 프로필)
        "subjects": {"국어": (4.6, 0.02, 1.05), "수학": (4.9, 0.05, 1.20),
                     "영어": (4.2, -0.04, 0.70), "탐구": (4.5, 0.01, 0.95)},
    },
    {
        "student_id": "stu_woojin", "name": "정우진", "school": "강남대성고등학교", "grade_year": "고3",
        "track": "자연", "target_univ": "서울대학교 의예과", "source_site": "메가스터디",
        "enroll": {
            "tier": "플러스", "region": "특별시",
            "household_income_manwon": 1200, "monthly_edu_cost_manwon": 150,
            "enrolled_at_remaining_months": 33,
            "monthly_saving": 300, "retire_goal": 60000,
        },
        # 최상위권, 안정적
        "subjects": {"국어": (1.6, -0.05, 0.24), "수학": (1.3, -0.03, 0.26),
                     "영어": (1.4, -0.02, 0.18), "탐구": (1.8, -0.06, 0.30)},
    },
    {
        "student_id": "stu_yuna", "name": "최유나", "school": "인천송도고등학교", "grade_year": "고3",
        "track": "인문", "target_univ": "성균관대학교 미디어학과", "source_site": "메가스터디",
        "enroll": {
            "tier": "스탠다드", "region": "대도시",
            "household_income_manwon": 550, "monthly_edu_cost_manwon": 60,
            "enrolled_at_remaining_months": 15,
            "monthly_saving": 150, "retire_goal": 30000,
        },
        # 하락 추세 (등급이 올라감)
        "subjects": {"국어": (2.6, 0.10, 0.55), "수학": (3.2, 0.14, 0.65),
                     "영어": (2.8, 0.08, 0.42), "탐구": (2.9, 0.11, 0.50)},
    },
    {
        "student_id": "stu_taemin", "name": "강태민", "school": "수원영통고등학교", "grade_year": "고3",
        "track": "자연", "target_univ": "한양대학교 기계공학과", "source_site": "메가스터디",
        "enroll": {
            "tier": "스탠다드", "region": "중소도시",
            "household_income_manwon": 450, "monthly_edu_cost_manwon": 50,
            "enrolled_at_remaining_months": 9,
            "monthly_saving": 100, "retire_goal": 25000,
        },
        # 중위권 완만한 상승 — 늦은 가입(잔여 9개월) 사례
        "subjects": {"국어": (3.9, -0.10, 0.45), "수학": (3.7, -0.13, 0.50),
                     "영어": (3.5, -0.09, 0.34), "탐구": (3.8, -0.11, 0.42)},
    },
]


def gen_series(start: float, trend: float, vol: float,
               rng: random.Random, n: int | None = None) -> list[float]:
    """등급 시계열 — 1~9 로 클립. trend 음수 = 성적 향상."""
    n = n if n is not None else len(EXAM_LABELS)
    return [
        max(GRADE_MIN, min(GRADE_MAX, round(start + trend * i + rng.gauss(0, vol), 2)))
        for i in range(n)
    ]


# 등급 → 대표 백분위 (표시용 근사. 수능 등급 구분 누적비율의 구간 중앙값)
_GRADE_PERCENTILE = {1: 98, 2: 93, 3: 84, 4: 70, 5: 50, 6: 30, 7: 16, 8: 7, 9: 2}


def grade_to_percentile(grade: float) -> float:
    """등급(소수 가능) → 백분위 근사. 표시 전용이며 판정에는 쓰지 않는다."""
    lo = max(1, min(9, int(grade)))
    hi = max(1, min(9, lo + 1))
    frac = grade - lo
    return round(_GRADE_PERCENTILE[lo] + (_GRADE_PERCENTILE[hi] - _GRADE_PERCENTILE[lo]) * frac, 1)


def build_rows(subjects: dict, rng: random.Random) -> list[dict]:
    rows = []
    for subject, (start, trend, vol) in subjects.items():
        series = gen_series(start, trend, vol, rng)
        for seq, (label, grade) in enumerate(zip(EXAM_LABELS, series), start=1):
            rows.append({
                "seq": seq, "label": label, "subject": subject,
                "grade": grade, "percentile": grade_to_percentile(grade),
            })
    return rows


def default_subject_profile(rng: random.Random) -> dict:
    """신규 가입자용 기본 성적 프로필 (성적 이력이 아직 없을 때)."""
    base = rng.uniform(3.0, 4.5)
    return {
        s: (round(base + rng.uniform(-0.4, 0.4), 2),
            round(rng.uniform(-0.14, 0.02), 3),
            round(rng.uniform(0.3, 0.8), 2))
        for s in SUBJECTS
    }


def main():
    db.ensure_schema()
    with db._connect() as conn, conn.cursor() as cur:
        cur.execute("delete from exam_scores")
        cur.execute("delete from renewals")
        cur.execute("delete from enrollments")
        cur.execute("delete from students")
        conn.commit()

    for idx, st in enumerate(STUDENTS):
        rng = random.Random(1000 + idx)   # 결정적 생성
        db.upsert_student({
            "student_id": st["student_id"], "name": st["name"], "school": st["school"],
            "grade_year": st["grade_year"], "track": st["track"],
            "target_univ": st["target_univ"], "source_site": st["source_site"],
        })
        e = dict(st["enroll"])
        e["academy_density_index"] = engine.density_index(e["region"])
        db.insert_enrollment({
            "student_id": st["student_id"], **e, "terms_agreed": True,
            "declared_subjects": SUBJECTS,
            # 자기신고 지표는 요율에서 배제하고 설문으로만 보관 (약관 '청약서 문항의 근거')
            "survey": {"source": st["source_site"], "track": st["track"],
                       "target": st["target_univ"]},
        })
        rows = build_rows(st["subjects"], rng)
        db.insert_scores(st["student_id"], rows)

        scores = {s: [r for r in rows if r["subject"] == s] for s in st["subjects"]}
        prof = engine.profile(scores, {**e, "tier": e["tier"]})
        mu = prof["analysis"]["band"]["predicted_grade"]
        print(f"  ✓ {st['name']} ({st['student_id']}) — 성적 {len(rows)}건 · "
              f"예측 {mu:.2f}등급 · {e['tier']} 잔여 {e['enrolled_at_remaining_months']}개월 "
              f"→ 월납 {prof['pricing']['monthly_premium']:,}원")

    print(f"\n완료: 학생 {len(STUDENTS)}명 · 회차 {len(EXAM_LABELS)}개 · 과목 {len(SUBJECTS)}개 "
          f"(판정 대상 {', '.join(sorted(engine.subject_weights()))})")


if __name__ == "__main__":
    main()
