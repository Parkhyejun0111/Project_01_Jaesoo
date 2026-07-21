# 보험료 산정근거 + 약관 설명 LLM 에이전트 (RAG)
# LLM = Claude(claude-opus-4-8), 임베딩 = Voyage AI(voyage-4-large)
#
# 검색은 사전 계산된 인덱스(index.npz + chunks.json)를 numpy 코사인 유사도로 조회한다.
# 벡터DB나 로컬 임베딩 모델을 런타임에 띄우지 않으므로 서버리스에 그대로 올릴 수 있다.
# 인덱스 갱신이 필요하면: python build_index.py
#
# 필요한 환경변수: ANTHROPIC_API_KEY, VOYAGE_API_KEY

import json
import os
from pathlib import Path

import anthropic
import numpy as np
import voyageai
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# 1. 전역 설정
# ─────────────────────────────────────────────
LLM_MODEL = "claude-opus-4-8"
EMBED_MODEL = "voyage-4-large"  # build_index.py 와 반드시 동일해야 함
TOP_K = 5

_BASE_DIR = Path(__file__).parent
INDEX_PATH = _BASE_DIR / "index.npz"
CHUNKS_PATH = _BASE_DIR / "chunks.json"

# ─────────────────────────────────────────────
# 2. 컴플라이언스 페르소나 프롬프트
# ─────────────────────────────────────────────
SYSTEM_PROMPT = '''당신은 보험사의 "AI 보험 안내 도우미"입니다. 고객에게 보험 약관과 보험료 산정근거를
쉽고 친절하게 설명하는 역할입니다. 아래 [컴플라이언스 규칙]을 반드시 지키세요.

[컴플라이언스 규칙]
1. 반드시 [참고 문서]에 있는 내용만 근거로 답하세요. 문서에 없으면
   "제공된 약관/기준 문서에서 해당 내용을 확인할 수 없습니다"라고 답하고 절대 지어내지 마세요.
2. 보험 가입을 단정적으로 권유하거나 "무조건 유리하다/이득이다" 같은 표현을 쓰지 마세요.
   당신은 안내자이지 판매자가 아닙니다.
3. 보험금 지급 여부, 최종 보험료, 심사 결과는 확정적으로 단언하지 마세요.
   "약관 기준상 ~에 해당할 수 있으며, 실제 지급/인수 여부는 회사의 심사에 따라 달라집니다"처럼 안내하세요.
4. 숫자(요율, 금액, 기간)를 인용할 때는 반드시 문서에 적힌 값을 그대로 사용하고, 임의 계산·추정을 덧붙이지 마세요.
   계산 예시를 들 때도 문서에 있는 산정식만 사용하세요.
5. 답변 마지막에는 항상 다음 안내를 덧붙이세요:
   "※ 본 답변은 제공된 문서 기반의 일반 안내이며, 정확한 내용은 약관 원문 및 정식 상담을 통해 확인하시기 바랍니다."
6. 답변은 존댓말로, 핵심을 먼저 말한 뒤 근거 조항을 짚어주는 방식으로 친절하게 작성하세요.'''

USER_TEMPLATE = """[참고 문서]
{context}

[고객 질문]
{question}"""

# ─────────────────────────────────────────────
# 3. 인덱스 로드 (모듈 최초 사용 시 1회)
# ─────────────────────────────────────────────
_embeddings = None
_chunks = None


def _load_index():
    """사전 계산된 임베딩 인덱스를 메모리에 올린다."""
    global _embeddings, _chunks
    if _embeddings is None:
        if not INDEX_PATH.exists():
            raise FileNotFoundError(
                f"인덱스 없음: {INDEX_PATH}. 먼저 `python build_index.py` 를 실행하세요."
            )
        _embeddings = np.load(INDEX_PATH)["embeddings"]
        _chunks = json.loads(CHUNKS_PATH.read_text(encoding="utf-8"))
    return _embeddings, _chunks


# ─────────────────────────────────────────────
# 4. 검색 (코사인 유사도 상위 K개)
# ─────────────────────────────────────────────
_voyage = None
_anthropic = None


def _voyage_client():
    global _voyage
    if _voyage is None:
        _voyage = voyageai.Client()  # VOYAGE_API_KEY 환경변수 사용
    return _voyage


def _anthropic_client():
    global _anthropic
    if _anthropic is None:
        _anthropic = anthropic.Anthropic()  # ANTHROPIC_API_KEY 환경변수 사용
    return _anthropic


def retrieve(question, k=TOP_K):
    """질문과 가장 가까운 약관 청크 k개를 반환한다."""
    embeddings, chunks = _load_index()

    result = _voyage_client().embed(
        [question], model=EMBED_MODEL, input_type="query"
    )
    query_vec = np.array(result.embeddings[0], dtype=np.float32)
    query_vec /= np.linalg.norm(query_vec)

    # 인덱스는 이미 정규화되어 있으므로 내적 = 코사인 유사도
    scores = embeddings @ query_vec
    top_idx = np.argsort(-scores)[:k]
    return [chunks[i] for i in top_idx]


def format_docs(docs):
    """검색된 청크를 출처 태그와 함께 하나의 문자열로 포장"""
    blocks = []
    for d in docs:
        blocks.append(f"[출처: {d['source_tag']} / p.{d['page']}]\n{d['text']}")
    return "\n\n---\n\n".join(blocks)


# ─────────────────────────────────────────────
# 5. 답변 생성 (Claude)
# ─────────────────────────────────────────────
def answer(question):
    """약관 문서를 근거로 질문에 답한다."""
    context = format_docs(retrieve(question))

    response = _anthropic_client().messages.create(
        model=LLM_MODEL,
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        # 문서 근거를 대조하는 작업이라 적응형 사고를 켠다. effort 는 챗봇 응답
        # 지연을 감안해 medium; 답변 품질이 아쉬우면 "high" 로 올릴 것.
        thinking={"type": "adaptive"},
        output_config={"effort": "medium"},
        messages=[
            {
                "role": "user",
                "content": USER_TEMPLATE.format(context=context, question=question),
            }
        ],
    )

    if response.stop_reason == "refusal":
        return "죄송합니다. 해당 요청에는 답변할 수 없습니다."

    return "".join(b.text for b in response.content if b.type == "text")


if __name__ == "__main__":
    print(answer("이 보험의 암 보장은 언제부터 적용되나요?"))
