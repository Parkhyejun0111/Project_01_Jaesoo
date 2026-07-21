# 보험료 산정근거 + 약관 설명 LLM 에이전트 (LangGraph + RAG + Gradio)
# terms_reader_agent.py 의 단일 LCEL 체인을 LangGraph 그래프로 재구성한 버전.
#
# 핵심 설계: 라우팅은 "어느 문서를 검색할지"에만 쓰고,
#            컴플라이언스 규칙은 모든 경로가 통과하는 generate 노드에 둔다.
#            → 라우터가 분류를 틀려도 검색 범위만 덜 최적일 뿐, 규칙 위반은 나지 않는다.
#
# 실행 전: .env 에 GEMINI_API_KEY 설정
# 실행:   uv run terms_reader_graph.py

import os
from typing import Literal, TypedDict

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel, Field
import gradio as gr

load_dotenv()

# ─────────────────────────────────────────────
# 1. 전역 설정
# ─────────────────────────────────────────────
LLM_MODEL = "gemini-2.5-flash"
PERSIST_DIR = "chroma_jaesoo_graph"   # PDF_SOURCES 를 바꾸면 폴더명도 같이 바꿔야 재인덱싱됨
COLLECTION = "insurance_collection"

PDF_SOURCES = [
    ("no_jaesoo_insurance_policy_3.pdf",           "약관"),
]

# ─────────────────────────────────────────────
# 2. 임베딩 + 벡터DB (있으면 로드, 없으면 생성)
# ─────────────────────────────────────────────
embeddings = HuggingFaceEmbeddings(
    model_name="jhgan/ko-sroberta-multitask",
    encode_kwargs={"normalize_embeddings": True},
)

if os.path.exists(PERSIST_DIR):
    vectordb = Chroma(
        persist_directory=PERSIST_DIR,
        embedding_function=embeddings,
        collection_name=COLLECTION,
    )
    print("기존 ChromaDB 로드 완료.")
else:
    print("새 ChromaDB 생성 중 (PDF 분석)...")
    all_docs = []
    splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=80)
    for path, source_tag in PDF_SOURCES:
        if not os.path.exists(path):
            raise FileNotFoundError(f"PDF 없음: {path}")
        pages = PyPDFLoader(path).load()
        chunks = splitter.split_documents(pages)
        for c in chunks:
            c.metadata["source_tag"] = source_tag
        all_docs.extend(chunks)
    vectordb = Chroma.from_documents(
        documents=all_docs,
        embedding=embeddings,
        persist_directory=PERSIST_DIR,
        collection_name=COLLECTION,
    )
    print(f"ChromaDB 생성 완료 (총 {len(all_docs)} 청크).")

llm = ChatGoogleGenerativeAI(
    model=LLM_MODEL,
    temperature=0.1,
    google_api_key=os.getenv("GEMINI_API_KEY"),
)


def make_retriever(source_tag=None, k=5):
    """source_tag 로 검색 범위를 좁힌 retriever. None 이면 전체 문서 대상."""
    search_kwargs = {"k": k}
    if source_tag:
        search_kwargs["filter"] = {"source_tag": source_tag}
    return vectordb.as_retriever(search_kwargs=search_kwargs)


# ─────────────────────────────────────────────
# 3. 그래프 상태
# ─────────────────────────────────────────────
class GraphState(TypedDict):
    question: str      # 고객 질문
    route: str         # 라우터가 고른 검색 경로
    docs: list         # 검색된 청크
    answer: str        # 최종 답변


# ─────────────────────────────────────────────
# 4. 라우터 — "어느 문서를 뒤질지"만 결정한다
#    답변 방식(권유 금지 등)은 여기서 다루지 않는다. generate 노드가 전담.
# ─────────────────────────────────────────────
class Route(BaseModel):
    destination: Literal["pricing", "exclusion", "general"] = Field(
        description=(
            "pricing: 보험료 금액·산정근거·요율·할인할증 등 상품요약서를 봐야 하는 질문. "
            "exclusion: 면책사유·보험금 부지급·지급 제한·감액 등 약관 조항을 봐야 하는 질문. "
            "general: 그 외 보장내용·가입조건·용어 등 문서 전반을 봐야 하는 질문."
        )
    )


router_prompt = ChatPromptTemplate.from_template('''
아래 고객 질문에 답하려면 어떤 문서를 검색해야 하는지 분류하세요.
질문에 답해서는 안 되고, 분류만 하면 됩니다.

[고객 질문]
{question}
''')

router = router_prompt | llm.with_structured_output(Route)


def route_question(state: GraphState) -> GraphState:
    try:
        destination = router.invoke({"question": state["question"]}).destination
    except Exception:
        destination = "general"   # 분류 실패는 전체 검색으로 안전하게 흡수
    print(f"[route] {destination}")
    return {"route": destination}


def pick_route(state: GraphState) -> str:
    return state["route"]


# ─────────────────────────────────────────────
# 5. 검색 노드들 — 경로별로 문서 범위와 질의를 다르게 가져간다
# ─────────────────────────────────────────────
def retrieve_pricing(state: GraphState) -> GraphState:
    """보험료 관련: 단일 약관 문서에서 요율·산정근거 위주로 질의 보강"""
    query = f"{state['question']} 보험료 산정 요율 할인 할증 산출"
    docs = make_retriever("약관").invoke(query)
    return {"docs": docs}


def retrieve_exclusion(state: GraphState) -> GraphState:
    """면책·부지급 관련: 약관 중심 + 해당 조항에서 쓰이는 용어로 질의 보강"""
    query = f"{state['question']} 면책사유 보험금을 지급하지 않는 사유 지급 제한 감액"
    docs = make_retriever("약관").invoke(query)
    return {"docs": docs}


def retrieve_general(state: GraphState) -> GraphState:
    """그 외: 문서 전체 대상"""
    docs = make_retriever().invoke(state["question"])
    return {"docs": docs}


# ─────────────────────────────────────────────
# 6. 생성 노드 — 모든 경로가 반드시 여기를 지난다.
#    컴플라이언스 규칙을 조건부가 아니라 무조건 적용하기 위한 구조.
# ─────────────────────────────────────────────
generate_prompt = ChatPromptTemplate.from_template('''
당신은 보험사의 "AI 보험 안내 도우미"입니다. 고객에게 보험 약관과 보험료 산정근거를
쉽고 친절하게 설명하는 역할입니다. 아래 [컴플라이언스 규칙]을 반드시 지키세요.

[컴플라이언스 규칙]
1. 반드시 아래 [참고 문서]에 있는 내용만 근거로 답하세요. 문서에 없으면
   "제공된 약관/기준 문서에서 해당 내용을 확인할 수 없습니다"라고 답하고 절대 지어내지 마세요.
2. 보험 가입을 단정적으로 권유하거나 "무조건 유리하다/이득이다" 같은 표현을 쓰지 마세요.
   당신은 안내자이지 판매자가 아닙니다.
3. 보험금 지급 여부, 최종 보험료, 심사 결과는 확정적으로 단언하지 마세요.
   "약관 기준상 ~에 해당할 수 있으며, 실제 지급/인수 여부는 회사의 심사에 따라 달라집니다"처럼 안내하세요.
4. 숫자(요율, 금액, 기간)를 인용할 때는 반드시 문서에 적힌 값을 그대로 사용하고, 임의 계산·추정을 덧붙이지 마세요.
   계산 예시를 들 때도 문서에 있는 산정식만 사용하세요.
5. 답변 본문 아래에는 반드시 "📌 근거 조항" 항목을 만들어, 답변의 근거가 된 조항 원문을 그대로 게시하세요.
   - 각 조항은 [참고 문서]에 표시된 출처와 페이지를 함께 적으세요. 예: "제12조(보험금의 지급사유) — 약관 p.7"
   - 조항 원문은 요약하거나 바꿔 쓰지 말고 문서에 적힌 문장을 그대로 인용하세요.
   - 조항 번호나 제목이 문서에 보이지 않으면 해당 부분의 원문과 페이지만 적으세요.
   - 근거로 삼은 조항이 [참고 문서]에 없으면 규칙 1에 따라 답변하고, 근거 조항 항목은 "해당 조항을 확인할 수 없습니다"라고 적으세요.
6. 답변 마지막에는 항상 다음 안내를 덧붙이세요:
   "※ 본 답변은 제공된 문서 기반의 일반 안내이며, 정확한 내용은 약관 원문 및 정식 상담을 통해 확인하시기 바랍니다."
7. 답변은 존댓말로, 핵심을 먼저 말한 뒤 근거 조항을 짚어주는 방식으로 친절하게 작성하세요.
                                                   
[참고 문서]
{context}

[고객 질문]
{question}
''')


def format_docs(docs):
    """검색된 청크를 출처 태그와 함께 하나의 문자열로 포장"""
    blocks = []
    for d in docs:
        tag = d.metadata.get("source_tag", "문서")
        page = d.metadata.get("page", "?")
        blocks.append(f"[출처: {tag} / p.{page}]\n{d.page_content}")
    return "\n\n---\n\n".join(blocks)


generate_chain = generate_prompt | llm | StrOutputParser()


def generate(state: GraphState) -> GraphState:
    answer = generate_chain.invoke({
        "context": format_docs(state["docs"]),
        "question": state["question"],
    })
    return {"answer": answer}


# ─────────────────────────────────────────────
# 7. 그래프 조립
#
#                    ┌→ retrieve_pricing   ─┐
#   START → route ───┼→ retrieve_exclusion ─┼→ generate → END
#                    └→ retrieve_general   ─┘
#
#   검색 경로는 갈라지지만 생성은 하나로 모인다 = 컴플라이언스 규칙 우회 불가
# ─────────────────────────────────────────────
builder = StateGraph(GraphState)
builder.add_node("route", route_question)
builder.add_node("retrieve_pricing", retrieve_pricing)
builder.add_node("retrieve_exclusion", retrieve_exclusion)
builder.add_node("retrieve_general", retrieve_general)
builder.add_node("generate", generate)

builder.add_edge(START, "route")
builder.add_conditional_edges(
    "route",
    pick_route,
    {
        "pricing": "retrieve_pricing",
        "exclusion": "retrieve_exclusion",
        "general": "retrieve_general",
    },
)
for node in ("retrieve_pricing", "retrieve_exclusion", "retrieve_general"):
    builder.add_edge(node, "generate")
builder.add_edge("generate", END)

graph = builder.compile()


# ─────────────────────────────────────────────
# 8. Gradio 챗봇 UI
# ─────────────────────────────────────────────
def respond(message, history):
    try:
        return graph.invoke({"question": message})["answer"]
    except Exception as e:
        return f"오류가 발생했습니다: {e}"


demo = gr.ChatInterface(
    fn=respond,
    title="🛡️ AI 보험 안내 도우미 (LangGraph)",
    description="보험 약관과 보험료 산정기준 문서를 기반으로 안내해 드립니다. 질문 유형에 따라 검색할 문서를 자동으로 선택합니다.",
    examples=[
        "보험료는 언제 지급되나요?",
        "고등학교 2학년도 보험에 가입할 수 있나요?",
        "플랜의 차이가 무엇인가요?",
        "모의고사 미응시의 경우, 보험료가 얼마나 올라가나요?",
    ],
)

if __name__ == "__main__":
    demo.launch()
