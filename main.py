"""Vercel 배포용 FastAPI 엔트리포인트.

Vercel의 Python 런타임은 모듈에서 `app` / `application` / `handler` 중 하나를
찾는다. 아래 `app` 객체가 그 진입점이다.

RAG 에이전트(terms_reader_agent)는 임베딩 인덱스를 메모리에 올리므로,
import 시점이 아니라 첫 요청 때 지연 로딩한다.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="AI 보험 안내 도우미 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vercel이 찾는 다른 이름들에 대한 별칭
application = app
handler = app

# 지연 로딩된 RAG 함수 캐시
_answer = None


def get_answer_fn():
    """terms_reader_agent.answer 를 최초 호출 시 한 번만 로드한다."""
    global _answer
    if _answer is None:
        from terms_reader_agent import answer

        _answer = answer
    return _answer


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str


@app.get("/")
def root():
    return {"service": "AI 보험 안내 도우미", "status": "ok"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """약관 문서 기반으로 질문에 답한다."""
    if not req.message.strip():
        return ChatResponse(answer="질문을 입력해 주세요.")
    try:
        return ChatResponse(answer=get_answer_fn()(req.message))
    except Exception as e:
        return ChatResponse(answer=f"오류가 발생했습니다: {e}")


def main():
    """로컬 실행용: uvicorn 개발 서버를 띄운다."""
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
