"""가상 데이터 시드 — 인강사이트에서 제공받았다고 가정한 학생/성적 + 가입설문.

실행:  python seed_supabase.py
멱등: 실행 시 기존 데이터를 지우고 다시 생성한다.
"""
from __future__ import annotations

import random

import db_supabase as db

EXAM_LABELS = ["고1 9월", "고1 12월", "고2 3월", "고2 6월", "고2 9월", "고2 12월", "고3 3월", "고3 6월", "고3 9월"]
SUBJECTS = ["국어", "수학", "영어", "탐구"]

# 학생 프로필 + 과목별 (시작 백분위, 회차당 추세, 변동성)
STUDENTS = [
    {
        "student_id": "stu_jimin", "name": "김지민", "school": "목동고등학교", "grade_year": "고3",
        "track": "자연", "target_univ": "서울대학교 경영학과", "source_site": "메가스터디",
        "enroll": {"tier": "스탠다드", "region": "서울 학군지", "income_band": 4, "retake_intent": 4,
                    "target_gap": "near", "monthly_saving": 200, "retire_goal": 40000},
        "subjects": {"국어": (57, 0.6, 8.5), "수학": (63, 1.1, 9.0), "영어": (52, 1.8, 3.0), "탐구": (58, 0.5, 6.2)},
    },
    {
        "student_id": "stu_seojun", "name": "박서준", "school": "분당고등학교", "grade_year": "고3",
        "track": "인문", "target_univ": "연세대학교 경제학과", "source_site": "메가스터디",
        "enroll": {"tier": "라이트", "region": "수도권", "income_band": 3, "retake_intent": 2,
                    "target_gap": "near", "monthly_saving": 120, "retire_goal": 20000},
        "subjects": {"국어": (60, 1.4, 3.2), "수학": (58, 1.6, 3.5), "영어": (65, 1.0, 2.5), "탐구": (62, 1.3, 3.0)},
    },
    {
        "student_id": "stu_haeun", "name": "이하은", "school": "대전한빛고등학교", "grade_year": "고3",
        "track": "자연", "target_univ": "고려대학교 컴퓨터학과", "source_site": "메가스터디",
        "enroll": {"tier": "프리미엄", "region": "지방", "income_band": 2, "retake_intent": 5,
                    "target_gap": "far", "monthly_saving": 60, "retire_goal": 15000},
        "subjects": {"국어": (48, 0.2, 12.0), "수학": (45, -0.3, 13.5), "영어": (55, 0.4, 8.0), "탐구": (50, 0.1, 11.0)},
    },
    {
        "student_id": "stu_woojin", "name": "정우진", "school": "강남대성고등학교", "grade_year": "고3",
        "track": "자연", "target_univ": "서울대학교 의예과", "source_site": "메가스터디",
        "enroll": {"tier": "플러스", "region": "서울 학군지", "income_band": 5, "retake_intent": 3,
                    "target_gap": "near", "monthly_saving": 300, "retire_goal": 60000},
        "subjects": {"국어": (78, 0.6, 2.8), "수학": (82, 0.5, 3.0), "영어": (80, 0.3, 2.0), "탐구": (76, 0.7, 3.4)},
    },
    {
        "student_id": "stu_yuna", "name": "최유나", "school": "인천송도고등학교", "grade_year": "고3",
        "track": "인문", "target_univ": "성균관대학교 미디어학과", "source_site": "메가스터디",
        "enroll": {"tier": "스탠다드", "region": "수도권", "income_band": 3, "retake_intent": 4,
                    "target_gap": "far", "monthly_saving": 150, "retire_goal": 30000},
        "subjects": {"국어": (68, -0.8, 6.5), "수학": (60, -1.2, 7.5), "영어": (66, -0.6, 5.0), "탐구": (64, -0.9, 6.0)},
    },
    {
        "student_id": "stu_taemin", "name": "강태민", "school": "수원영통고등학교", "grade_year": "고3",
        "track": "자연", "target_univ": "한양대학교 기계공학과", "source_site": "메가스터디",
        "enroll": {"tier": "스탠다드", "region": "수도권", "income_band": 3, "retake_intent": 3,
                    "target_gap": "near", "monthly_saving": 100, "retire_goal": 25000},
        "subjects": {"국어": (55, 0.9, 5.5), "수학": (57, 1.3, 6.0), "영어": (59, 0.8, 4.0), "탐구": (56, 1.0, 5.2)},
    },
]


def gen_series(start: float, trend: float, vol: float, rng: random.Random) -> list[float]:
    out = []
    for i in range(len(EXAM_LABELS)):
        val = start + trend * i + rng.gauss(0, vol)
        out.append(max(3, min(99, round(val, 1))))
    return out


def main():
    db.ensure_schema()
    with db._connect() as conn, conn.cursor() as cur:
        cur.execute("delete from exam_scores")
        cur.execute("delete from enrollments")
        cur.execute("delete from students")
        conn.commit()

    for idx, st in enumerate(STUDENTS):
        rng = random.Random(1000 + idx)  # 결정적 생성
        db.upsert_student({
            "student_id": st["student_id"], "name": st["name"], "school": st["school"],
            "grade_year": st["grade_year"], "track": st["track"],
            "target_univ": st["target_univ"], "source_site": st["source_site"],
        })
        e = st["enroll"]
        db.insert_enrollment({
            "student_id": st["student_id"], "tier": e["tier"], "region": e["region"],
            "income_band": e["income_band"], "retake_intent": e["retake_intent"],
            "target_gap": e["target_gap"], "monthly_saving": e["monthly_saving"],
            "retire_goal": e["retire_goal"], "terms_agreed": True,
            "survey": {"source": st["source_site"], "track": st["track"], "target": st["target_univ"]},
        })
        rows = []
        for subj, (start, trend, vol) in st["subjects"].items():
            series = gen_series(start, trend, vol, rng)
            for seq, (label, pct) in enumerate(zip(EXAM_LABELS, series), start=1):
                rows.append({"seq": seq, "label": label, "subject": subj, "percentile": pct})
        db.insert_scores(st["student_id"], rows)
        print(f"  ✓ {st['name']} ({st['student_id']}) — {len(rows)} 성적 · 가입설문 1")

    print(f"완료: 학생 {len(STUDENTS)}명 시드")


if __name__ == "__main__":
    main()
