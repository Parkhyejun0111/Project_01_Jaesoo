"""시연용 프로필 3인 — 중증 청구 대상 / 경증 청구 대상 / 청구 비대상.

발표에서 보여줄 세 가지 판정 결과를 각각 대표하는 계약을 **실제 DB 에** 만든다.
프론트에 목업 데이터를 두지 않는 이유는 두 가지다.

  · 챗봇이 답을 만들 때 쓰는 개인화 맥락(_student_context)은 DB 를 읽는다.
    프론트에만 있는 목업은 여기에 잡히지 않아서, 목업 계정으로 로그인하면
    LLM 이 "그 학생"을 모르는 채로 약관만 보고 답하게 된다.
  · 요율·판정·갱신은 전부 engine 이 DB 성적으로 계산한다. 목업 숫자는 이
    계산과 어긋나므로 화면끼리 값이 맞지 않는다.

세 사람의 설계
  demo_severe  이서연  고3 9월모평까지(9회차) · 수능 급락 → 중증 (z ≤ −2.25)
  demo_mild    한지우  고3 9월모평까지(9회차) · 수능 하락 → 경증 (−2.25 < z ≤ −1.75)
  demo_none    오세훈  고2 9월까지(6회차)     · 수능 정상 → 비대상 (z > −1.75)

demo_none 만 고3 회차가 비어 있다. 고3 9월모평이 찍히면 보험료가 동결되어
화면의 "다음 갱신 D-day" 가 숫자 대신 '동결'로 뜨기 때문이다(약관 제17조).
6회차면 최소 관측 회차(9회 중 5회)를 넘겨서 밴드·판정은 정상 산출된다.

실행:  python -m seed_demo_profiles          (기존 demo_* 만 지우고 다시 만든다)
"""
from __future__ import annotations

import random

import db_supabase as db
import engine

EXAM_LABELS = engine.ROUNDS
SUBJECTS = ["국어", "수학", "영어", "탐구"]

# 판정 경계 — engine.severity_of 와 같은 값을 쓴다.
#   z = −(수능등급 − μ̂) / σ  이므로, 목표 z 를 만족하는 수능 등급은
#   grade = μ̂ − z·σ  로 역산된다.
SIGMA = engine.SIGMA_BAND


def _demo(student_id: str, name: str, target_z: float, rounds: int, **kw) -> dict:
    return {"student_id": student_id, "name": name,
            "target_z": target_z, "rounds": rounds, **kw}


DEMOS = [
    _demo(
        "demo_severe", "이서연", target_z=-2.60, rounds=9,
        school="서울과학고등학교", grade_year="고3", track="자연",
        target_univ="서울대학교 컴퓨터공학부", source_site="메가스터디",
        enroll={
            "tier": "프리미엄",
            "region": "특별시",
            "household_income_manwon": 850,
            "monthly_edu_cost_manwon": 130,
            "enrolled_at_remaining_months": 33,
            "surrender_type": "표준형",
            "monthly_saving": 250,
            "retire_goal": 50000,
            "residence_sido": "서울",
            "residence_gu": "강남구",
        },
        # 상위권이었다가 고3 들어 흔들리는 프로필 — 변동성이 커야 급락이 자연스럽다
        subjects={"국어": (88, -0.4, 6.5), "수학": (91, -0.8, 7.5),
                  "영어": (86, -0.3, 5.5), "탐구": (89, -0.6, 6.0)},
    ),
    _demo(
        "demo_mild", "한지우", target_z=-1.95, rounds=9,
        school="분당대진고등학교", grade_year="고3", track="인문",
        target_univ="연세대학교 사회학과", source_site="메가스터디",
        enroll={
            "tier": "플러스",
            "region": "대도시",
            "household_income_manwon": 600,
            "monthly_edu_cost_manwon": 75,
            "enrolled_at_remaining_months": 27,
            "surrender_type": "표준형",
            "monthly_saving": 160,
            "retire_goal": 35000,
            "residence_sido": "경기",
            "residence_gu": None,
        },
        subjects={"국어": (80, 0.3, 4.5), "수학": (76, 0.2, 5.0),
                  "영어": (83, 0.5, 3.8), "탐구": (79, 0.1, 4.2)},
    ),
    _demo(
        "demo_none", "오세훈", target_z=-0.35, rounds=6,
        school="부산해운대고등학교", grade_year="고3", track="자연",
        target_univ="부산대학교 전기공학과", source_site="메가스터디",
        enroll={
            "tier": "스탠다드",
            "region": "대도시",
            "household_income_manwon": 480,
            "monthly_edu_cost_manwon": 55,
            "enrolled_at_remaining_months": 21,
            "surrender_type": "표준형",
            "monthly_saving": 130,
            "retire_goal": 28000,
            "residence_sido": "부산",
            "residence_gu": None,
        },
        subjects={"국어": (74, 0.9, 3.2), "수학": (71, 1.1, 3.6),
                  "영어": (78, 0.7, 2.8), "탐구": (73, 1.0, 3.0)},
    ),
]

DEMO_IDS = tuple(d["student_id"] for d in DEMOS)


def build_rows(subjects: dict, rng: random.Random, rounds: int) -> list[dict]:
    """백분위가 1차 값. 등급은 engine 환산표로 함께 저장한다(참고용).

    rounds 를 9 보다 작게 주면 뒤쪽 회차를 아예 만들지 않는다 — '아직 안 친 시험'
    이므로 0 점이 아니라 행 자체가 없어야 한다.
    """
    rows: list[dict] = []
    for subject, (start, trend, vol) in subjects.items():
        for seq in range(1, rounds + 1):
            pct = start + trend * (seq - 1) + rng.gauss(0, vol)
            pct = max(1.0, min(99.9, round(pct, 1)))
            rows.append({
                "seq": seq, "label": EXAM_LABELS[seq - 1], "subject": subject,
                "percentile": pct, "grade": engine.percentile_to_grade(pct),
            })
    return rows


def _actual_percentile_for(mu_hat: float, target_z: float) -> float:
    """목표 z 를 만드는 수능 백분위.

    z = −(grade − μ̂)/σ  →  grade = μ̂ − z·σ
    등급을 백분위로 되돌려 저장한다(서비스 단위가 백분위라서).
    """
    grade = mu_hat - target_z * SIGMA
    grade = max(1.0, min(9.0, grade))
    return round(engine.grade_to_percentile(grade), 1)


def main() -> None:
    db.ensure_schema()

    # 시연 계정만 지운다. 다른 학생·계약은 건드리지 않는다.
    with db._connect() as conn, conn.cursor() as cur:
        for table in ("jaesoo_exam_scores", "jaesoo_renewals", "jaesoo_enrollments"):
            cur.execute(f"delete from {table} where student_id = any(%s)", (list(DEMO_IDS),))
        cur.execute("delete from jaesoo_students where student_id = any(%s)", (list(DEMO_IDS),))
        conn.commit()
    print(f"기존 시연 계정 삭제: {', '.join(DEMO_IDS)}")

    for idx, d in enumerate(DEMOS):
        rng = random.Random(20260727 + idx)      # 결정적 생성
        sid = d["student_id"]

        db.upsert_student({
            "student_id": sid, "name": d["name"], "school": d["school"],
            "grade_year": d["grade_year"], "track": d["track"],
            "target_univ": d["target_univ"], "source_site": d["source_site"],
        })

        e = dict(d["enroll"])
        e["academy_density_index"] = engine.density_index(e["region"])
        db.insert_enrollment({
            "student_id": sid, **e, "terms_agreed": True,
            "declared_subjects": SUBJECTS,
            "survey": {
                "source": d["source_site"], "track": d["track"],
                "target": d["target_univ"],
                "demo_case": {"demo_severe": "중증 청구 대상",
                              "demo_mild": "경증 청구 대상",
                              "demo_none": "청구 비대상"}[sid],
            },
        })

        rows = build_rows(d["subjects"], rng, d["rounds"])
        db.insert_scores(sid, rows)

        # 밴드가 잡힌 뒤에야 목표 z 를 만족하는 수능 성적을 역산할 수 있다.
        scores = {s: [r for r in rows if r["subject"] == s] for s in d["subjects"]}
        analysis = engine.analyze(scores)
        mu_hat = analysis["band"]["predicted_grade"]
        actual_pct = _actual_percentile_for(mu_hat, d["target_z"])
        db.set_actual_percentile(sid, actual_pct)

        verdict = engine.eligibility(scores, {**e}, actual_percentile=actual_pct)
        prof = engine.profile(scores, {**e, "tier": e["tier"]})
        print(
            f"  ✓ {d['name']} ({sid}) — {d['rounds']}회차 성적 {len(rows)}건 · "
            f"예측 {mu_hat:.2f}등급 · 수능 {actual_pct}%ile "
            f"→ z {verdict['z']:+.2f} · {verdict['severity']} "
            f"({e['tier']} 월납 {prof['pricing']['monthly_premium']:,}원)"
        )

    print(f"\n완료: 시연 계정 {len(DEMOS)}명")


if __name__ == "__main__":
    main()
