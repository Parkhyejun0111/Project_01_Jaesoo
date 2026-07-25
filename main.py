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
from receipt_verification import create_receipt_router

try:
    from dotenv import load_dotenv

    load_dotenv(override=True)
except Exception:  # noqa: BLE001
    pass

app = FastAPI(title="재수없수 API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(create_receipt_router())
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
    import db_supabase as db
    from rag_light import available_providers, pick_provider, selected_model_type

    provider = pick_provider()
    return {
        "status": "ok",
        "llm": provider is not None,
        "provider": provider or "fallback",
        "model": selected_model_type(provider),
        "available": available_providers(),  # 키가 채워진 프로바이더 전체
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
# 요인별 '보험료 상승/하강률(%)'과 방향(위험↑/위험↓)을 고객에게 보여준다.
# 확률(R_i)·스코어카드 원점수·수식은 노출하지 않고, 엔진이 계산한 % 만 넘긴다.
# 소득·거주지에서 나오는 '가구 배경'은 민감정보라 표에서 제외한다.
_FACTOR_DISPLAY = {
    "재수 의향": "재수 의향",
    "목표 격차": "목표 격차",
    "성적 변동성": "성적 변동성",
    "성적 추세": "성적 추세",
}
_SENSITIVE_FACTORS = {"가구 배경"}


def _rate_rows(rates: dict) -> list[tuple[str, float]]:
    """{요인: 상승/하강률%} → 민감 요인을 뺀 (표시명, %) 목록. 절대값 큰 순."""
    rows = [(_FACTOR_DISPLAY[k], v) for k, v in rates.items()
            if k not in _SENSITIVE_FACTORS and k in _FACTOR_DISPLAY]
    return sorted(rows, key=lambda kv: -abs(kv[1]))


def _rate_table(rates: dict) -> str:
    """요인·상승/하강률·방향 3열 표의 데이터 줄을 프롬프트에 실을 문자열로 만든다."""
    def direction(v: float) -> str:
        return "위험 ↑" if v > 0 else "위험 ↓" if v < 0 else "중립 —"

    return "\n".join(f"    | {name} | {v:+.1f}% | {direction(v)} |"
                     for name, v in _rate_rows(rates))


def _student_context(student_id: str) -> str:
    try:
        prof = _build_profile(student_id)
        if not prof:
            return ""
        s = prof["student"]
        p = prof["pricing"]
        weak_str = ", ".join(w["subject"] for w in prof["analysis"]["weak_subjects"][:2])
        # 확률·원점수·수식은 싣지 않되, 요인별 보험료 상승/하강률(%)·방향은 표로 넘긴다.
        rate_block = _rate_table(p.get("factor_rates", {}))
        return (
            "\n[상담 대상 학생의 확정 산정값 — 우리 계리 엔진이 계산한 값이니 그대로 인용하세요. 새 숫자를 지어내지 마세요]\n"
            f"- 이름: {s['name']} ({s.get('school','')}, 목표 {s.get('target_univ','')})\n"
            f"- 가입 상품(티어): {p['tier']}  → 보장금 경증 {p['cover_mild']:,}원 / 중증 {p['cover_sev']:,}원\n"
            f"- 이번 달 월 보험료: {p['monthly_premium']:,}원 (납입 33개월)\n"
            f"- 종합 예상 수능 백분위: {prof['analysis']['composite']['predicted']}\n"
            f"- 성적 기복이 큰 과목: {weak_str}\n"
            "\n[보험료에 영향을 준 요인 — 아래 표의 요인·보험료 영향·방향만 그대로 쓰세요. 없는 요인·수치를 새로 만들지 마세요]\n"
            "    | 요인 | 보험료 영향 | 방향 |\n"
            "    | --- | --- | --- |\n"
            f"{rate_block}\n"
            "  (위 '보험료 영향'은 '그 요인이 없었다면 대비' 계산값 — 이 계산 방식·주의는 내부용이니\n"
            "   절대 화면에 옮겨 쓰지 마세요. 수치와 방향만 보여줍니다.)\n"
            "\n[설명 지침]\n"
            "- 금액을 물으면 월 보험료와 보장금액을 2열 표로 제시합니다.\n"
            "- '왜 이 금액인가'를 물으면 위 요인 표를 '요인 | 보험료 영향 | 방향' 3열 그대로 옮기세요.\n"
            "  '보험료 영향'은 +8% 처럼 부호와 % 를 포함해 그대로, 방향은 위험↑ / 위험↓ 로 적습니다.\n"
            "  '보험료 영향'의 계산 방식이나 '요인끼리 정확히 합산되지 않는다' 같은 설명은 붙이지 마세요.\n"
            "  개인 재수확률(R_i)·사고확률·급락확률 같은 확률 수치·명칭과 스코어카드 원점수·공식·계수·기호(σ, z)는\n"
            "  어떤 형태로도 쓰지 마세요(컴플라이언스 규칙 5).\n"
            "- 이전 답변에서 안 보여준 요인을 새로 물으면, '오타/실수가 있었다'는 식으로 지어내 정정·사과하지 마세요.\n"
            "  앞서 안 보인 건 질문 범위가 좁았을 뿐이니, 그냥 이번 질문에 맞는 요인을 담담하게 새로 안내하면 됩니다.\n"
            "- 소득·거주지·가정 환경·가구 배경은 산정 요인으로 언급하지 마세요(민감정보). 표에도 넣지 않습니다.\n"
            "- 낮추는 방법을 물으면 위 '성적 기복이 큰 과목'이 안정되면 낮아질 수 있다고 안내합니다.\n"
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
        # provider/error 를 그대로 흘려보낸다 — 폴백이 일어났을 때 원인을 알 수 있어야 한다.
        return {
            "answer": out["answer"], "sources": out.get("sources", []), "llm": out.get("llm", False),
            "suggestions": out.get("suggestions", []),
            "provider": out.get("provider"), "error": out.get("error"),
        }
    except Exception as e:  # noqa: BLE001
        return {"answer": f"오류가 발생했습니다: {e}", "sources": [], "llm": False}


def main():
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
