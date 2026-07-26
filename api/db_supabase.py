"""Supabase Postgres 연결 + 스키마 + 조회 (개인화 대시보드용)

테이블 (전부 `jaesoo_` 접두사)
  · jaesoo_students     — 학생 식별(이름/학교/목표대학/계열/인강사이트)
  · jaesoo_enrollments  — 임베디드 가입 시 받은 설문/약관동의 데이터
  · jaesoo_exam_scores  — 과목별 모의고사 백분위 종단데이터
  · jaesoo_renewals     — 갱신 이력 (별표1 · 제25조)

★ 접두사를 쓰는 이유: 이 Supabase 프로젝트를 다른 앱과 공유한다. 접두사가 없으면
  같은 이름의 남의 테이블(jaesoo_students/claims 등)과 충돌해, create-if-not-exists 가
  조용히 건너뛰고 런타임에 컬럼이 없어 깨진다.

백엔드는 신뢰 영역이므로 anon 키/RLS 대신 DB 비밀번호로 Postgres 에 직접 접속한다.
(Supabase Transaction Pooler, 포트 6543)
"""
from __future__ import annotations

import json
import os
from contextlib import contextmanager

from dotenv import load_dotenv

load_dotenv()

_CONN_KW = dict(
    host=os.getenv("SUPABASE_DB_HOST", ""),
    port=int(os.getenv("SUPABASE_DB_PORT", "6543")),
    user=os.getenv("SUPABASE_DB_USER", ""),
    password=os.getenv("SUPABASE_DB_PASSWORD", ""),
    dbname=os.getenv("SUPABASE_DB_NAME", "postgres"),
    sslmode="require",
    connect_timeout=10,
)


def enabled() -> bool:
    return bool(_CONN_KW["host"] and _CONN_KW["user"] and _CONN_KW["password"])


def _connect():
    import psycopg

    conn = psycopg.connect(**_CONN_KW)
    # Supabase Transaction Pooler(pgbouncer)는 prepared statement 를 지원하지 않으므로 비활성화
    conn.prepare_threshold = None
    return conn


def connect():
    """Return a configured connection for modules sharing this Supabase DB."""
    return _connect()


@contextmanager
def _use(conn):
    """커넥션을 넘겨받으면 그대로 쓰고, 없으면 새로 열었다 닫는다.

    DB 는 서울(ap-northeast-2), 함수는 서버리스라 커넥션 하나 여는 값(TLS+인증
    왕복)이 질의보다 비싸다. 한 요청에서 여러 번 쓰는 경로(enroll)는 커넥션을
    하나로 묶어야 한다 — 예전엔 4개를 따로 열어 제출에만 7초가 걸렸고,
    함수 제한시간을 넘겨 브라우저에 'Load failed' 로 떨어지곤 했다.
    """
    if conn is not None:
        yield conn
        return
    own = _connect()
    try:
        yield own
    finally:
        own.close()


SCHEMA = """
create table if not exists jaesoo_students (
  student_id  text primary key,
  name        text not null,
  school      text,
  grade_year  text,
  track       text,          -- 계열: 인문/자연
  target_univ text,
  source_site text,          -- 인강 사이트 (메가스터디 등)
  created_at  timestamptz default now()
);

create table if not exists jaesoo_enrollments (        -- table01: 가입 설문/약관
  id            bigint generated always as identity primary key,
  student_id    text references jaesoo_students(student_id),
  tier          text,          -- 라이트/스탠다드/플러스/프리미엄
  -- ── 요율 3지표 (약관 별표4 · 청약서 요율 반영 3문항) ──
  region                   text,   -- 특별시/대도시/중소도시/읍면지역 (지역규모)
  academy_density_index    int,     -- 4/3/2/1 (= 5 − 지역규모)
  household_income_manwon  int,     -- 월평균 가구소득, 만원
  monthly_edu_cost_manwon  int,     -- 피보험자 1인 월교육비, 만원
  -- ── 계약 조건 ──
  enrolled_at_remaining_months int default 33,  -- 잔여 납입개월 (late 산출, 별표2)
  declared_subjects        text[],  -- 수능 응시과목 선언 (별표6)
  surrender_type           text default '표준형',  -- 표준형/무해약환급금형 (별표5)
  -- ── 돈워리 계산기 전용 (요율 무관) ──
  monthly_saving int,          -- 만원
  retire_goal   int,           -- 만원
  terms_agreed  boolean default false,
  -- 자기신고 지표(재수의향·목표격차·학교유형 등)는 요율에서 배제하고
  -- 포트폴리오 분석 전용으로 survey 에만 보관한다 (약관 '청약서 문항의 근거').
  survey        jsonb,
  created_at    timestamptz default now()
);

create table if not exists jaesoo_exam_scores (        -- table02: 성적 종단
  id          bigint generated always as identity primary key,
  student_id  text references jaesoo_students(student_id),
  seq         int,             -- 회차(1~9)
  exam_label  text,            -- '고1_3월' … '고3_9월모평' (engine.ROUNDS 와 동일)
  subject     text,            -- 국어/수학/영어/탐구
  grade       numeric,         -- 등급 1~9 (낮을수록 우수) ← 급락 판정·요율의 기준
  percentile  numeric,         -- 백분위 (표시 참고용, 판정에는 쓰지 않음)
  created_at  timestamptz default now()
);
create index if not exists idx_jaesoo_scores_student on jaesoo_exam_scores(student_id, subject, seq);

create table if not exists jaesoo_renewals (          -- table03: 갱신 이력 (별표1 · 제25조)
  id            bigint generated always as identity primary key,
  student_id    text references jaesoo_students(student_id),
  step          text,          -- 1차/2차/3차
  renewed_at    text,          -- 고2 3월 / 고3 3월 / 고3 9월
  previous_premium int,
  theoretical_premium int,     -- 상한 적용 전 이론 보험료
  applied_premium  int,        -- 상한 적용 후
  carried_forward  numeric default 0,   -- 초과분 이월 비율
  created_at    timestamptz default now()
);
create index if not exists idx_jaesoo_renewals_student on jaesoo_renewals(student_id, created_at);
"""

# 기존 배포본을 새 스키마로 올리는 증분 마이그레이션.
# create table if not exists 만으로는 이미 존재하는 테이블에 컬럼이 추가되지 않는다.
MIGRATIONS = """
alter table jaesoo_exam_scores  add column if not exists grade numeric;
alter table jaesoo_exam_scores  alter column percentile drop not null;
alter table jaesoo_enrollments  add column if not exists academy_density_index int;
alter table jaesoo_enrollments  add column if not exists household_income_manwon int;
alter table jaesoo_enrollments  add column if not exists monthly_edu_cost_manwon int;
alter table jaesoo_enrollments  add column if not exists enrolled_at_remaining_months int default 33;
alter table jaesoo_enrollments  add column if not exists declared_subjects text[];
alter table jaesoo_enrollments  add column if not exists surrender_type text default '표준형';
"""


def ensure_schema() -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(SCHEMA)
        cur.execute(MIGRATIONS)
        conn.commit()


# ── 조회 ────────────────────────────────────────────────────────────────────
def list_students() -> list[dict]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "select s.student_id, s.name, s.school, s.grade_year, s.target_univ, s.track, s.source_site, "
            "e.tier from jaesoo_students s left join jaesoo_enrollments e on e.student_id = s.student_id order by s.name"
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def get_student(student_id: str) -> dict | None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("select * from jaesoo_students where student_id = %s", (student_id,))
        row = cur.fetchone()
        if not row:
            return None
        cols = [d.name for d in cur.description]
        student = dict(zip(cols, row))
        cur.execute(
            "select * from jaesoo_enrollments where student_id = %s order by created_at desc limit 1",
            (student_id,),
        )
        erow = cur.fetchone()
        if erow:
            ecols = [d.name for d in cur.description]
            student["enrollment"] = dict(zip(ecols, erow))
        return student


def get_scores(student_id: str, conn=None) -> dict:
    """{subject: [{seq, label, grade, percentile}, ...]} (seq 순).

    grade(등급 1~9)가 판정·요율의 기준이고 percentile 은 표시 참고용이다.
    """
    with _use(conn) as conn, conn.cursor() as cur:
        cur.execute(
            "select subject, seq, exam_label, grade, percentile from jaesoo_exam_scores "
            "where student_id = %s order by subject, seq",
            (student_id,),
        )
        out: dict[str, list] = {}
        for subject, seq, label, grade, pct in cur.fetchall():
            out.setdefault(subject, []).append({
                "seq": seq, "label": label,
                "grade": float(grade) if grade is not None else None,
                "percentile": float(pct) if pct is not None else None,
            })
        return out


# ── 쓰기 ────────────────────────────────────────────────────────────────────
def upsert_student(s: dict, conn=None) -> None:
    with _use(conn) as conn, conn.cursor() as cur:
        cur.execute(
            """insert into jaesoo_students (student_id, name, school, grade_year, track, target_univ, source_site)
               values (%(student_id)s, %(name)s, %(school)s, %(grade_year)s, %(track)s, %(target_univ)s, %(source_site)s)
               on conflict (student_id) do update set
                 name=excluded.name, school=excluded.school, grade_year=excluded.grade_year,
                 track=excluded.track, target_univ=excluded.target_univ, source_site=excluded.source_site""",
            s,
        )
        conn.commit()


_ENROLL_DEFAULTS = {
    "tier": "스탠다드", "region": None, "academy_density_index": None,
    "household_income_manwon": None, "monthly_edu_cost_manwon": None,
    "enrolled_at_remaining_months": 33, "declared_subjects": None,
    "surrender_type": "표준형", "monthly_saving": None, "retire_goal": None,
    "terms_agreed": False,
}


def insert_enrollment(e: dict, conn=None) -> int:
    params = {**_ENROLL_DEFAULTS, **e,
              "survey": json.dumps(e.get("survey") or {}, ensure_ascii=False)}
    with _use(conn) as conn, conn.cursor() as cur:
        cur.execute(
            """insert into jaesoo_enrollments
               (student_id, tier, region, academy_density_index,
                household_income_manwon, monthly_edu_cost_manwon,
                enrolled_at_remaining_months, declared_subjects, surrender_type,
                monthly_saving, retire_goal, terms_agreed, survey)
               values (%(student_id)s, %(tier)s, %(region)s, %(academy_density_index)s,
                       %(household_income_manwon)s, %(monthly_edu_cost_manwon)s,
                       %(enrolled_at_remaining_months)s, %(declared_subjects)s, %(surrender_type)s,
                       %(monthly_saving)s, %(retire_goal)s, %(terms_agreed)s, %(survey)s)
               returning id""",
            params,
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        return new_id


def insert_scores(student_id: str, rows: list[dict], conn=None) -> None:
    """rows: [{seq, label, subject, grade, percentile?}, ...]"""
    with _use(conn) as conn, conn.cursor() as cur:
        cur.executemany(
            "insert into jaesoo_exam_scores (student_id, seq, exam_label, subject, grade, percentile) "
            "values (%s, %s, %s, %s, %s, %s)",
            [(student_id, r["seq"], r["label"], r["subject"],
              r.get("grade"), r.get("percentile")) for r in rows],
        )
        conn.commit()


def insert_renewal(r: dict) -> int:
    """갱신 이력 1건 (별표1 · 제25조)."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """insert into jaesoo_renewals
               (student_id, step, renewed_at, previous_premium,
                theoretical_premium, applied_premium, carried_forward)
               values (%(student_id)s, %(step)s, %(renewed_at)s, %(previous_premium)s,
                       %(theoretical_premium)s, %(applied_premium)s, %(carried_forward)s)
               returning id""",
            {"carried_forward": 0, **r},
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        return new_id


def list_renewals(student_id: str) -> list[dict]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "select step, renewed_at, previous_premium, theoretical_premium, "
            "applied_premium, carried_forward, created_at from jaesoo_renewals "
            "where student_id = %s order by created_at",
            (student_id,),
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
