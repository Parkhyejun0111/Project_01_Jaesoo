"""경량 RAG 엔진 — 실제 약관 PDF 기반 질의응답 (Anthropic Claude)

원본 terms_reader_agent.py 는 Gemini + 로컬 임베딩(sentence-transformers) + chromadb 를 쓰지만,
번들이 무겁고 배포/검증이 어렵다. 이 모듈은 동일한 목적을 가볍게 재구성한다.

  · 검색(retrieval): PDF 를 pypdf 로 읽어 청킹 → 순수 파이썬 TF-IDF (임베딩 API·torch 불필요)
  · 생성(generation): Anthropic claude-opus-4-8 (원본의 컴플라이언스 페르소나 프롬프트 재사용)
  · 폴백: LLM_API_KEY 가 없으면 검색된 약관 발췌를 그대로 정리해 답변 (키 없이도 동작)

인터페이스(answer_question)만 고정돼 있어, 나중에 벡터 검색으로 교체해도 호출부는 그대로다.
"""
from __future__ import annotations

import math
import os
import re
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or ""
LLM_MODEL = os.getenv("LLM_MODEL", "claude-opus-4-8")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_PATH = os.path.join(_BASE_DIR, os.getenv("POLICY_PDF", "policy_full.pdf"))

# 원본 terms_reader_agent.py 의 컴플라이언스 페르소나 프롬프트 (그대로 재사용)
SYSTEM_PROMPT = """당신은 보험사의 "AI 보험 안내 도우미"입니다. 고객에게 보험 약관과 보험료 산정근거를
쉽고 친절하게, 그리고 근거에 충실하게 설명하는 역할입니다.

━━━━━━━━━━━━━━━━━━━━
[입력 형식]
매 질문마다 검색된 근거 문서가 아래 형태로 함께 주어집니다.
각 조각(chunk)에는 출처 식별자(예: [문서2 · 제12조])가 붙어 있습니다.

<참고 문서>
{context}
</참고 문서>

<질문>
{question}
</질문>

━━━━━━━━━━━━━━━━━━━━
[근거 활용 규칙 — RAG 정확도의 핵심]
① 관련성 판별: 주어진 조각 중 질문과 실제로 관련된 것만 근거로 쓰세요.
   상위에 검색됐더라도 무관한 조각은 무시하고 답에 끌어오지 마세요.
② 충분성 판단: 답하기 전에 "이 문서만으로 답할 수 있는가"를 먼저 점검하세요.
   - 전부 답 가능 → 답하되, 핵심 문장 끝마다 [문서n · 조항] 형태로 출처를 답니다.
   - 일부만 가능 → 가능한 부분만 답하고, 나머지는
     "제공된 문서에서 ○○ 부분은 확인할 수 없습니다"라고 명시합니다.
   - 관련 근거 없음 → "제공된 약관/기준 문서에서 해당 내용을 확인할 수 없습니다"라고만
     답하고, 외부 지식·일반 상식으로 메우지 마세요.
③ 원문 인용 우선: 숫자(요율·금액·기간·나이)와 조건은 문서에 적힌 값을 그대로 옮기고,
   임의 계산·합산·추정·반올림을 하지 마세요. 값 옆에는 반드시 출처 조항을 붙입니다.
④ 상충 처리: 두 조각의 내용이 다르면 임의로 하나를 고르지 말고,
   "문서에 따라 ○○과 △△로 다르게 기재되어 있어 확인이 필요합니다"라고 함께 안내합니다.
⑤ 질문 분해: 여러 조건이 얽힌 질문은 조건별로 나눠, 각 조건의 근거를 짚어 답합니다.
⑥ 사실/안내 구분: 문서에서 직접 확인된 사실과 그로부터 이어지는 일반 안내를 구분하고,
   확인되지 않은 것을 확인된 것처럼 단정하지 마세요.

━━━━━━━━━━━━━━━━━━━━
[컴플라이언스 규칙]
1. 위 [근거 활용 규칙]에 따라 문서 근거로만 답합니다.
2. 가입을 단정적으로 권유하거나 "무조건 유리하다/이득이다" 같은 표현을 쓰지 마세요.
   당신은 안내자이지 판매자가 아닙니다.
3. 보험금 지급 여부·최종 보험료·심사 결과는 단언하지 말고,
   "약관 기준상 ~에 해당할 수 있으며, 실제 지급/인수 여부는 회사 심사에 따라 달라집니다"처럼 안내합니다.
4. 문서에 없는 수치·조건을 만들어내지 마세요(③과 동일).
5. 답변 마지막에는 항상 다음을 덧붙입니다:
   "※ 본 답변은 제공된 문서 기반의 일반 안내이며, 정확한 내용은 약관 원문 및 정식 상담을 통해 확인하시기 바랍니다."
6. 존댓말로, 핵심을 먼저 말한 뒤 근거 조항을 짚어주는 방식으로 작성합니다.

━━━━━━━━━━━━━━━━━━━━
[답변 형식 — 가독성 규칙]
- 맨 처음은 '한 줄 요약'으로 시작. (예: "✅ 핵심부터 말씀드리면, ...")
- 2~4문장 단위로 문단을 나누고 문단 사이에 빈 줄.
- 이모지는 절제해서. (✅ 요약 · 📌 조건 · 💡 팁 · ⚠️ 주의 · 📄 근거)
- 어려운 용어는 괄호로 풀어 설명.
- ★ 여러 항목·조건·수치·티어를 나열하거나 비교할 때는 반드시 '마크다운 표'로 정리해 제시하라.
  표 형식은 정확히 아래처럼 (헤더 줄 + 구분선 줄 + 데이터 줄):
  | 항목 | 값 |
  | --- | --- |
  | 경증 사고확률 | 1.04% |
  | 중증 사고확률 | 1.63% |
- 표로 정리한 뒤, 표 아래에 1~2문장으로 핵심 해석을 덧붙여라.
- 단순 서술 답변은 6~10줄 이내로 간결하게.
- 예시:
  ✅ (한 줄 요약)

  📌 (핵심 내용)

  | 요소 | 내용 |
  | --- | --- |
  | (항목1) | (값1) |
  | (항목2) | (값2) |

  💡 (표 해석 1~2문장)

  ※ 본 답변은 ..."""

_STOP = {"그리고", "그러나", "합니다", "입니다", "있습니다", "대한", "위한", "경우", "이다", "하는", "되는", "및", "등"}


def _tokenize(text: str) -> list[str]:
    clean = re.sub(r"[^0-9a-z가-힣\s]", " ", (text or "").lower())
    words = [w for w in clean.split() if len(w) >= 2 and w not in _STOP]
    grams: list[str] = []
    for w in words:
        grams.append(w)
        if re.search(r"[가-힣]", w) and len(w) >= 3:  # 한글 2-gram 으로 부분 매칭 강화
            grams += [w[i:i + 2] for i in range(len(w) - 1)]
    return grams


# 브라우저 인쇄본 PDF 의 머리말/꼬리말 노이즈 (약관 내용 아님)
_NOISE = re.compile(
    r"(^\s*\d+\.\s*\d+\.\s*\d+\.\s*(오전|오후).*$)"      # "26. 7. 20. 오후 5:39 ..."
    r"|(^\s*file:///.*$)"                                  # "file:///C:/.../....html 2/14"
    r"|(^\s*재수없수\s*!\s*—.*통합판.*$)"                  # 페이지 상단 반복 제목
    r"|(^\s*\d+\s*/\s*14\s*$)",                            # "2/14" 페이지 번호
    re.MULTILINE,
)


def _clean(text: str) -> str:
    text = _NOISE.sub("", text.replace("\r", ""))
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _load_chunks() -> list[dict]:
    """PDF → 페이지별 텍스트 → 조(제N조)/문단 단위 청킹."""
    from pypdf import PdfReader

    reader = PdfReader(PDF_PATH)
    chunks: list[dict] = []
    for pageno, page in enumerate(reader.pages, start=1):
        text = _clean(page.extract_text() or "")
        if not text:
            continue
        # '제N조' 경계 또는 빈 줄로 분할
        parts = re.split(r"(?=제\s*\d+\s*조)|\n\s*\n", text)
        for part in parts:
            part = part.strip()
            if len(part) < 30:
                # 짧은 조각은 직전 청크에 붙여 문맥 유지
                if chunks:
                    chunks[-1]["text"] += "\n" + part
                continue
            m = re.match(r"(제\s*\d+\s*조\s*\([^)]*\))", part) or re.match(r"(제\s*\d+\s*조)", part)
            title = re.sub(r"\s+", " ", m.group(1)).strip() if m else part.split("\n")[0][:40]
            chunks.append({"page": pageno, "title": title, "text": part})
    return chunks


@lru_cache(maxsize=1)
def _index():
    """청크 + DF(문서빈도) 색인 (최초 1회 구축, 캐시)."""
    chunks = _load_chunks()
    df: dict[str, int] = {}
    for c in chunks:
        toks = _tokenize(c["text"])
        tf: dict[str, int] = {}
        for t in toks:
            tf[t] = tf.get(t, 0) + 1
        c["tf"] = tf
        c["len"] = max(len(toks), 1)
        for t in tf:
            df[t] = df.get(t, 0) + 1
    n = max(len(chunks), 1)
    return {"chunks": chunks, "df": df, "n": n}


def retrieve(query: str, k: int = 5) -> list[dict]:
    """TF-IDF 코사인 유사도 상위 k 청크."""
    idx = _index()
    if not idx["chunks"]:
        return []
    qtf: dict[str, int] = {}
    for t in _tokenize(query):
        qtf[t] = qtf.get(t, 0) + 1

    def idf(t: str) -> float:
        return math.log((idx["n"] + 1) / (idx["df"].get(t, 0) + 1)) + 1

    scored = []
    for c in idx["chunks"]:
        dot = 0.0
        for t, qf in qtf.items():
            cf = c["tf"].get(t)
            if cf:
                dot += (qf * idf(t)) * (cf / c["len"] * idf(t))
        if dot > 0:
            scored.append((dot, c))
    scored.sort(key=lambda x: -x[0])
    return [
        {"page": c["page"], "title": c["title"], "text": c["text"], "score": round(s, 3)}
        for s, c in scored[:k]
    ]


@lru_cache(maxsize=1)
def _page_texts() -> dict:
    """PDF 페이지별 전체 텍스트(정제본). 근거 팝업용."""
    from pypdf import PdfReader

    reader = PdfReader(PDF_PATH)
    out: dict[int, str] = {}
    for pageno, page in enumerate(reader.pages, start=1):
        out[pageno] = _clean(page.extract_text() or "")
    return out


def page_text(pageno: int) -> dict:
    """지정 페이지의 조항 제목 추정 + 전문 반환."""
    txt = _page_texts().get(int(pageno), "")
    titles = re.findall(r"제\s*\d+\s*조\s*\([^)]*\)", txt)
    title = re.sub(r"\s+", " ", titles[0]).strip() if titles else ""
    return {"page": int(pageno), "title": title, "text": txt}


def _format_docs(hits: list[dict]) -> str:
    return "\n\n---\n\n".join(f"[출처: 약관 / p.{h['page']} / {h['title']}]\n{h['text']}" for h in hits)


def _anthropic_enabled() -> bool:
    return bool(LLM_API_KEY and LLM_API_KEY.startswith("sk-ant-"))


def _openai_enabled() -> bool:
    return bool(OPENAI_API_KEY and OPENAI_API_KEY.startswith("sk-"))


def _llm_enabled() -> bool:
    return _openai_enabled() or _anthropic_enabled()


def _user_content(query: str, hits: list[dict], student_context: str = "") -> str:
    ctx = f"{student_context}\n" if student_context else ""
    return f"[참고 문서]\n{_format_docs(hits)}\n{ctx}\n[고객 질문]\n{query}"


def _history_msgs(history: list[dict]) -> list[dict]:
    return [
        {"role": m["role"], "content": m["content"]}
        for m in (history or [])[-6:]
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]


def _ipv4_httpx():
    """httpx 클라이언트를 IPv4 로 강제 (일부 환경에서 IPv6 로 붙으려다 멈추는 문제 회피)."""
    import httpx

    return httpx.Client(
        transport=httpx.HTTPTransport(local_address="0.0.0.0", retries=1),
        timeout=httpx.Timeout(45.0, connect=8.0),
    )


def _generate_claude(query: str, hits: list[dict], history: list[dict], student_context: str = "") -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=LLM_API_KEY, max_retries=1, http_client=_ipv4_httpx())
    messages = _history_msgs(history) + [{"role": "user", "content": _user_content(query, hits, student_context)}]
    resp = client.messages.create(
        model=LLM_MODEL, max_tokens=1200, system=SYSTEM_PROMPT, messages=messages,
    )
    return "".join(b.text for b in resp.content if b.type == "text").strip()


def _generate_openai(query: str, hits: list[dict], history: list[dict], student_context: str = "") -> str:
    # openai SDK 가 이 환경에서 멈추는 문제가 있어 원시 httpx 로 직접 호출한다(검증됨).
    import httpx

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += _history_msgs(history)
    messages.append({"role": "user", "content": _user_content(query, hits, student_context)})
    r = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        json={"model": OPENAI_MODEL, "max_tokens": 1200, "temperature": 0.1, "messages": messages},
        timeout=httpx.Timeout(40.0, connect=8.0),
    )
    r.raise_for_status()
    return (r.json()["choices"][0]["message"]["content"] or "").strip()


def _generate(query: str, hits: list[dict], history: list[dict], student_context: str = "") -> tuple[str, str]:
    """(답변, 사용한 provider). OpenAI 우선, 없으면 Anthropic."""
    if _openai_enabled():
        return _generate_openai(query, hits, history, student_context), "openai"
    return _generate_claude(query, hits, history, student_context), "anthropic"


def _generate_fallback(query: str, hits: list[dict]) -> str:
    if not hits:
        return ("제공된 약관 문서에서 관련 조항을 찾지 못했어요. 질문을 조금 더 구체적으로 "
                "(예: '보험금은 언제 지급되나요?', '보험료 갱신은 어떻게 되나요?') 다시 물어봐 주세요.")
    top = hits[0]
    body = re.sub(r"\n{2,}", " ", top["text"]).strip()[:400]
    return (f"【{top['title']}】 {body}\n\n"
            f"(약관 p.{top['page']} 발췌 기준)\n"
            "※ 본 답변은 제공된 문서 기반의 일반 안내이며, 정확한 내용은 약관 원문 및 정식 상담을 통해 확인하시기 바랍니다.")


def answer_question(message: str, history: list[dict] | None = None, student_context: str = "") -> dict:
    """질문 → {answer, sources, llm}.  history=[{role, content}, ...] (선택).
       student_context: 로그인 학생의 확정 산출값(보험료·위험확률 등)을 넣으면 개인화 설명."""
    query = (message or "").strip()
    if not query:
        return {"answer": "질문을 입력해 주세요.", "sources": [], "llm": False}
    hits = retrieve(query, k=5)
    sources = [{"page": h["page"], "title": h["title"]} for h in hits]
    if _llm_enabled():
        try:
            answer, provider = _generate(query, hits, history or [], student_context)
            return {"answer": answer, "sources": sources, "llm": True, "provider": provider}
        except Exception as e:  # noqa: BLE001 — 어떤 오류든 폴백
            return {"answer": _generate_fallback(query, hits), "sources": sources, "llm": False, "error": str(e)}
    return {"answer": _generate_fallback(query, hits), "sources": sources, "llm": False}


if __name__ == "__main__":
    for q in ["보험금은 언제 지급되나요?", "청약철회는 어떻게 하나요?", "보험료 갱신은 어떤 기준인가요?"]:
        out = answer_question(q)
        print(f"\nQ: {q}\n[llm={out['llm']} · 출처 {[s['page'] for s in out['sources']]}]\nA: {out['answer'][:300]}")
