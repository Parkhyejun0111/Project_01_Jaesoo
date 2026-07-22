"""Supabase Postgres 연결 + 스키마 + 조회 (개인화 대시보드용)

테이블
  · students     — 학생 식별(이름/학교/목표대학/계열/인강사이트)
  · enrollments  — (table01) 임베디드 가입 시 받은 설문/약관동의 데이터
  · exam_scores  — (table02) 인강사이트에서 제공받은 과목별 모의고사 백분위 종단데이터

백엔드는 신뢰 영역이므로 anon 키/RLS 대신 DB 비밀번호로 Postgres 에 직접 접속한다.
(Supabase Transaction Pooler, 포트 6543)
"""
from __future__ import annotations

import json
import os

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


SCHEMA = """
create table if not exists students (
  student_id  text primary key,
  name        text not null,
  school      text,
  grade_year  text,
  track       text,          -- 계열: 인문/자연
  target_univ text,
  source_site text,          -- 인강 사이트 (메가스터디 등)
  created_at  timestamptz default now()
);

create table if not exists enrollments (        -- table01: 가입 설문/약관
  id            bigint generated always as identity primary key,
  student_id    text references students(student_id),
  tier          text,          -- 라이트/스탠다드/플러스/프리미엄
  region        text,          -- 서울 학군지/비학군지/수도권/지방
  income_band   int,           -- 1~5
  retake_intent int,           -- 1~5
  target_gap    text,          -- near/far
  monthly_saving int,          -- 만원
  retire_goal   int,           -- 만원
  terms_agreed  boolean default false,
  survey        jsonb,
  created_at    timestamptz default now()
);

create table if not exists exam_scores (        -- table02: 성적 종단
  id          bigint generated always as identity primary key,
  student_id  text references students(student_id),
  seq         int,             -- 회차(1~9)
  exam_label  text,            -- '고2 3월' 등
  subject     text,            -- 국어/수학/영어/탐구
  percentile  numeric,
  created_at  timestamptz default now()
);
create index if not exists idx_scores_student on exam_scores(student_id, subject, seq);
"""


def ensure_schema() -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(SCHEMA)
        conn.commit()


# ── 조회 ────────────────────────────────────────────────────────────────────
def list_students() -> list[dict]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "select s.student_id, s.name, s.school, s.grade_year, s.target_univ, s.track, s.source_site, "
            "e.tier from students s left join enrollments e on e.student_id = s.student_id order by s.name"
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def get_student(student_id: str) -> dict | None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("select * from students where student_id = %s", (student_id,))
        row = cur.fetchone()
        if not row:
            return None
        cols = [d.name for d in cur.description]
        student = dict(zip(cols, row))
        cur.execute(
            "select * from enrollments where student_id = %s order by created_at desc limit 1",
            (student_id,),
        )
        erow = cur.fetchone()
        if erow:
            ecols = [d.name for d in cur.description]
            student["enrollment"] = dict(zip(ecols, erow))
        return student


def get_scores(student_id: str) -> dict:
    """{subject: [{seq, label, percentile}, ...]} (seq 순)."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "select subject, seq, exam_label, percentile from exam_scores "
            "where student_id = %s order by subject, seq",
            (student_id,),
        )
        out: dict[str, list] = {}
        for subject, seq, label, pct in cur.fetchall():
            out.setdefault(subject, []).append(
                {"seq": seq, "label": label, "percentile": float(pct)}
            )
        return out


# ── 쓰기 ────────────────────────────────────────────────────────────────────
def upsert_student(s: dict) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """insert into students (student_id, name, school, grade_year, track, target_univ, source_site)
               values (%(student_id)s, %(name)s, %(school)s, %(grade_year)s, %(track)s, %(target_univ)s, %(source_site)s)
               on conflict (student_id) do update set
                 name=excluded.name, school=excluded.school, grade_year=excluded.grade_year,
                 track=excluded.track, target_univ=excluded.target_univ, source_site=excluded.source_site""",
            s,
        )
        conn.commit()


def insert_enrollment(e: dict) -> int:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """insert into enrollments
               (student_id, tier, region, income_band, retake_intent, target_gap,
                monthly_saving, retire_goal, terms_agreed, survey)
               values (%(student_id)s, %(tier)s, %(region)s, %(income_band)s, %(retake_intent)s, %(target_gap)s,
                       %(monthly_saving)s, %(retire_goal)s, %(terms_agreed)s, %(survey)s)
               returning id""",
            {**e, "survey": json.dumps(e.get("survey", {}), ensure_ascii=False)},
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        return new_id


def insert_scores(student_id: str, rows: list[dict]) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.executemany(
            "insert into exam_scores (student_id, seq, exam_label, subject, percentile) "
            "values (%s, %s, %s, %s, %s)",
            [(student_id, r["seq"], r["label"], r["subject"], r["percentile"]) for r in rows],
        )
        conn.commit()
