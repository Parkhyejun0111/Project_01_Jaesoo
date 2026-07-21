"""FastAPI 엔트리포인트 — 프론트엔드가 호출하는 백엔드.

  · /api/students            로그인용 학생 목록 (인강사이트 제공 가정 데이터)
  · /api/student/{id}        개인 프로필 + 성적분석 + 위험확률 + 보험료 (엔진 산출)
  · /api/student/{id}/scores 과목별 모의고사 백분위 종단데이터
  · /api/enroll              임베디드 가입 설문/약관 저장 (table01)
  · /api/chat                약관 RAG 챗봇 (student_id 있으면 개인화 설명)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # noqa: BLE001
    pass

app = FastAPI(title="재수없수 API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
application = app
handler = app


# ── 모델 ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    history: list[dict] | None = None
    student_id: str | None = None


class EnrollRequest(BaseModel):
    name: str
    school: str | None = None
    grade_year: str | None = "고3"
    track: str | None = None
    target_univ: str | None = None
    source_site: str | None = "메가스터디"
    tier: str = "스탠다드"
    region: str = "수도권"
    income_band: int = 3
    retake_intent: int = 3
    target_gap: str = "near"
    monthly_saving: int = 100
    retire_goal: int = 20000
    terms_agreed: bool = True
    gender: str | None = None
    survey: dict | None = None


@app.get("/")
def root():
    return {"service": "재수없수 API", "status": "ok"}


@app.get("/api/health")
def health():
    import os

    import db_supabase as db

    openai_on = (os.getenv("OPENAI_API_KEY") or "").startswith("sk-")
    anthropic_on = (os.getenv("LLM_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or "").startswith("sk-ant-")
    return {
        "status": "ok",
        "llm": openai_on or anthropic_on,
        "provider": "openai" if openai_on else ("anthropic" if anthropic_on else "fallback"),
        "db": db.enabled(),
    }


# ── 학생/개인화 ──────────────────────────────────────────────────────────────
@app.get("/api/students")
def students():
    import db_supabase as db

    try:
        return {"students": db.list_students()}
    except Exception as e:  # noqa: BLE001
        return {"students": [], "error": str(e)}


@app.get("/api/tiers")
def tiers():
    """티어 선택 화면용 보험료·보장 표 (포트폴리오 기준선)."""
    import engine

    return {"tiers": engine.tier_table()}


def _build_profile(student_id: str):
    import db_supabase as db
    import engine

    student = db.get_student(student_id)
    if not student:
        return None
    scores = db.get_scores(student_id)
    prof = engine.profile(scores, student.get("enrollment"))
    return {"student": student, "scores": scores, **prof}


@app.get("/api/student/{student_id}")
def student_profile(student_id: str):
    try:
        prof = _build_profile(student_id)
        if not prof:
            return {"error": "not_found"}
        return prof
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


@app.get("/api/student/{student_id}/scores")
def student_scores(student_id: str):
    import db_supabase as db

    try:
        return {"scores": db.get_scores(student_id)}
    except Exception as e:  # noqa: BLE001
        return {"scores": {}, "error": str(e)}


@app.post("/api/enroll")
def enroll(req: EnrollRequest):
    import re

    import db_supabase as db

    try:
        sid = "stu_" + re.sub(r"[^a-z0-9]", "", (req.name or "user").lower()) + "_" + str(abs(hash(req.name)) % 10000)
        db.upsert_student({
            "student_id": sid, "name": req.name, "school": req.school, "grade_year": req.grade_year,
            "track": req.track, "target_univ": req.target_univ, "source_site": req.source_site,
        })
        survey = req.survey or {"source": req.source_site, "track": req.track, "target": req.target_univ}
        if req.gender:
            survey = {**survey, "성별": req.gender}
        db.insert_enrollment({
            "student_id": sid, "tier": req.tier, "region": req.region, "income_band": req.income_band,
            "retake_intent": req.retake_intent, "target_gap": req.target_gap,
            "monthly_saving": req.monthly_saving, "retire_goal": req.retire_goal,
            "terms_agreed": req.terms_agreed,
            "survey": survey,
        })
        # 신규 가입자는 성적 이력이 아직 없으므로, 데모용 기본 성적을 생성해 붙임
        try:
            if not db.get_scores(sid):
                import seed_supabase as seed
                import random
                rng = random.Random(abs(hash(sid)) % 100000)
                rows = []
                for subj, (start, trend, vol) in {"국어": (58, 0.7, 6), "수학": (56, 0.9, 7), "영어": (60, 0.8, 4), "탐구": (57, 0.6, 5)}.items():
                    series = seed.gen_series(start, trend, vol, rng)
                    for seq, (label, pct) in enumerate(zip(seed.EXAM_LABELS, series), start=1):
                        rows.append({"seq": seq, "label": label, "subject": subj, "percentile": pct})
                db.insert_scores(sid, rows)
        except Exception:  # noqa: BLE001
            pass
        return {"ok": True, "student_id": sid}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


# ── RAG 챗봇 (개인화) ────────────────────────────────────────────────────────
def _student_context(student_id: str) -> str:
    try:
        prof = _build_profile(student_id)
        if not prof:
            return ""
        s = prof["student"]
        p = prof["pricing"]
        weak = prof["analysis"]["weak_subjects"][:2]
        weak_str = ", ".join(f"{w['subject']}(변동성 {w['volatility']})" for w in weak)
        pts = p.get("score_points", {})
        pts_str = ", ".join(f"{k} {v:+.2f}" for k, v in pts.items())
        return (
            "\n[상담 대상 학생의 확정 산정값 — 아래 수치·로직은 우리 계리 엔진이 계산한 것이니 그대로 인용해 개인화 설명하세요. 새 숫자를 지어내지 마세요]\n"
            f"- 이름: {s['name']} ({s.get('school','')}, 목표 {s.get('target_univ','')})\n"
            f"- 가입 상품(티어): {p['tier']}  → 보장금 경증 {p['cover_mild']:,}원 / 중증 {p['cover_sev']:,}원\n"
            f"- 이번 달 월 보험료: {p['monthly_premium']:,}원 (연 영업보험료 {p['gross_annual']:,}원 ÷ 33개월)\n"
            "\n[보험료 산정 로직 — 이 구조로 설명하세요]\n"
            "① 위험확률은 2항 구조입니다: P(사고)=P(급락)×P(재수|급락).\n"
            "   - 급락 임계: 경증 −2.5σ<z≤−2.0σ, 중증 z≤−2.5σ (수능 백분위가 예측 밴드 하단을 벗어난 정도)\n"
            f"   - 이 학생의 개인 재수확률 R_i = {p['R']:.2f} (스코어카드로 산출, 포트폴리오 평균 0.27)\n"
            f"   - 개인 사고확률: 경증 {p['risk_mild']*100:.2f}% + 중증 {p['risk_sev']*100:.2f}% = 총 {p['risk_prob']*100:.2f}%\n"
            f"② R_i 를 올린/내린 요인(스코어카드 점수, +일수록 위험↑): {pts_str}\n"
            f"   - 특히 성적 변동성이 큰 취약 과목: {weak_str} (같은 불운에도 성적이 더 크게 흔들림)\n"
            "③ 보험료 = (기대손실 × (1+안전할증 0.24) + 정액운영비 9,950원) ÷ (1 − 제휴수수료 0.12 − 변동비 0.03)\n"
            "   - 기대손실 = 경증사고확률×경증보장 + 중증사고확률×중증보장\n"
            "   - 인강 임베디드(B2B2C) 채널이라 사업비가 낮아 요율이 저렴합니다.\n"
            f"- 종합 예상 수능 백분위: {prof['analysis']['composite']['predicted']}\n"
            "설명 시: 결론(월 보험료) → 왜 이 금액인지(R_i와 그걸 만든 요인) → 낮추려면(변동성 안정) 순으로, 따뜻하고 쉽게.\n"
        )
    except Exception:  # noqa: BLE001
        return ""


@app.get("/api/policy/pages")
def policy_pages(p: str = ""):
    """근거로 인용된 약관 페이지들의 전문 반환 (챗봇 근거 팝업용)."""
    try:
        from rag_light import page_text

        nums, seen = [], set()
        for x in p.split(","):
            x = x.strip()
            if x.isdigit() and int(x) not in seen:
                seen.add(int(x))
                nums.append(int(x))
        return {"pages": [page_text(n) for n in nums]}
    except Exception as e:  # noqa: BLE001
        return {"pages": [], "error": str(e)}


@app.post("/api/chat", response_model=None)
def chat(req: ChatRequest):
    if not req.message.strip():
        return {"answer": "질문을 입력해 주세요.", "sources": [], "llm": False}
    try:
        from rag_light import answer_question

        ctx = _student_context(req.student_id) if req.student_id else ""
        out = answer_question(req.message, req.history or [], student_context=ctx)
        return {"answer": out["answer"], "sources": out.get("sources", []), "llm": out.get("llm", False)}
    except Exception as e:  # noqa: BLE001
        return {"answer": f"오류가 발생했습니다: {e}", "sources": [], "llm": False}


def main():
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
