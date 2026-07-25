"""가상 데이터 시드 — 인강사이트에서 제공받았다고 가정한 학생/성적 + 가입 청약.

성적은 **백분위 0~100(높을수록 우수)** 로 생성한다 — 서비스가 다루는 단위다.
약관 별표3 의 밴드 판정은 등급 단위라 engine 이 내부에서만 등급으로 환산하며,
참고용 등급 값도 함께 저장한다.

회차 라벨은 engine.ROUNDS(별표3 §1 · 별표7)와 정확히 같아야 한다:
    고1 3·6·9월 · 고2 3·6·9월 · 고3 5·6월 · 고3 9월모평   (9회)

실행:  python seed_supabase.py
멱등: 실행 시 우리 4개 테이블만 비우고 다시 생성한다.
      같은 DB 를 다른 앱과 공유할 수 있으므로 그 밖의 테이블은 건드리지 않는다.
"""
from __future__ import annotations

import random

import db_supabase as db
import engine

EXAM_LABELS = engine.ROUNDS          # 9회차 — engine 과 단일 소스
SUBJECTS = ["국어", "수학", "영어", "탐구"]

PCT_MIN, PCT_MAX = 3.0, 99.0

# 학생 프로필 + 과목별 (시작 백분위, 회차당 추세, 변동성)
#   trend 양수 = 백분위가 올라감 = 성적 향상
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
        "subjects": {"국어": (79, 0.9, 5.0), "수학": (83, 1.2, 7.5),
                     "영어": (74, 1.8, 3.0), "탐구": (80, 0.7, 4.5)},
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
        "subjects": {"국어": (82, 1.5, 2.6), "수학": (80, 1.7, 3.0),
                     "영어": (86, 1.1, 2.0), "탐구": (84, 1.4, 2.4)},
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
        "subjects": {"국어": (62, -0.2, 10.5), "수학": (58, -0.5, 12.0),
                     "영어": (67, 0.4, 7.0), "탐구": (63, -0.1, 9.5)},
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
        "subjects": {"국어": (95, 0.4, 1.8), "수학": (96, 0.3, 2.0),
                     "영어": (96, 0.2, 1.4), "탐구": (94, 0.5, 2.2)},
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
        # 하락 추세 (백분위가 내려감)
        "subjects": {"국어": (90, -1.1, 5.0), "수학": (85, -1.5, 6.0),
                     "영어": (89, -0.9, 4.0), "탐구": (88, -1.2, 4.6)},
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
        "subjects": {"국어": (71, 1.1, 4.2), "수학": (74, 1.4, 4.8),
                     "영어": (77, 1.0, 3.2), "탐구": (72, 1.2, 4.0)},
    },
]


def gen_series(start: float, trend: float, vol: float,
               rng: random.Random, n: int | None = None) -> list[float]:
    """백분위 시계열 — 0~100 으로 클립. trend 양수 = 성적 향상."""
    n = n if n is not None else len(EXAM_LABELS)
    return [
        max(PCT_MIN, min(PCT_MAX, round(start + trend * i + rng.gauss(0, vol), 1)))
        for i in range(n)
    ]


def build_rows(subjects: dict, rng: random.Random) -> list[dict]:
    """백분위가 1차 값. 등급은 engine 의 환산표로 함께 저장한다(참고용)."""
    rows = []
    for subject, (start, trend, vol) in subjects.items():
        series = gen_series(start, trend, vol, rng)
        for seq, (label, pct) in enumerate(zip(EXAM_LABELS, series), start=1):
            rows.append({
                "seq": seq, "label": label, "subject": subject,
                "percentile": pct, "grade": engine.percentile_to_grade(pct),
            })
    return rows


def default_subject_profile(rng: random.Random) -> dict:
    """신규 가입자용 기본 성적 프로필 (성적 이력이 아직 없을 때). 백분위 기준."""
    base = rng.uniform(62, 80)
    return {
        s: (round(base + rng.uniform(-5, 5), 1),
            round(rng.uniform(-0.3, 1.4), 2),
            round(rng.uniform(3.0, 7.0), 1))
        for s in SUBJECTS
    }


# 이 스크립트가 비우는 테이블. 같은 DB 를 다른 앱과 공유할 수 있으므로 목록을
# 명시해 두고, 여기 없는 테이블은 절대 건드리지 않는다.
# (외래키 때문에 자식 → 부모 순서로 지운다)
OWNED_TABLES = ("jaesoo_exam_scores", "jaesoo_renewals",
                "jaesoo_enrollments", "jaesoo_students")


def main(*, reset: bool = True):
    db.ensure_schema()
    if reset:
        with db._connect() as conn, conn.cursor() as cur:
            for table in OWNED_TABLES:
                cur.execute(f"delete from {table}")
            conn.commit()
        print(f"기존 데이터 삭제: {', '.join(OWNED_TABLES)}")

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
        band = prof["analysis"]["band"]
        print(f"  ✓ {st['name']} ({st['student_id']}) — 성적 {len(rows)}건 · "
              f"예측 {band['predicted_percentile']:.1f}%ile · "
              f"{e['tier']} 잔여 {e['enrolled_at_remaining_months']}개월 "
              f"→ 월납 {prof['pricing']['monthly_premium']:,}원")

    print(f"\n완료: 학생 {len(STUDENTS)}명 · 회차 {len(EXAM_LABELS)}개 · 과목 {len(SUBJECTS)}개 "
          f"(판정 대상 {', '.join(sorted(engine.subject_weights()))}) · 단위 백분위")


if __name__ == "__main__":
    main()
