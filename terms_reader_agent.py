# 보험료 산정근거 + 약관 설명 LLM 에이전트 (RAG + Gradio)
# LLM = Gemini(무료 한도), 임베딩 = 로컬 한국어 모델(내 PC 실행 · 한도/비용 없음)
#   → Gemini 임베딩은 무료 한도가 분당 100건이라, 수백 쪽짜리 약관을 넣으면 429가 남.
#     임베딩만 로컬로 돌리면 문서가 아무리 커도 무제한.
# 실행 전: .env 에 GEMINI_API_KEY 설정
# 실행:   python llm_1.py

import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
import gradio as gr

load_dotenv()

# ─────────────────────────────────────────────
# 1. 전역 설정  
# ─────────────────────────────────────────────
LLM_MODEL = "gemini-2.5-flash"   # Gemini 채팅 모델
PERSIST_DIR = "my_chroma_hanwha_local"   # 실제 한화 PDF + 로컬 임베딩용 폴더
COLLECTION = "insurance_collection"

# 넣을 PDF 파일들: (파일경로, 문서종류 태그)
PDF_SOURCES = [
    ("no_jaesoo_insurance_policy.pdf",           "약관"),
]

# ─────────────────────────────────────────────
# 2. 임베딩 + 벡터DB (있으면 로드, 없으면 생성)
# ─────────────────────────────────────────────
embeddings = HuggingFaceEmbeddings(
    model_name="jhgan/ko-sroberta-multitask",   # 한국어 특화 임베딩(로컬 실행, 무제한)
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
            raise FileNotFoundError(f"PDF 없음: {path}  → 먼저 create_insurance_pdfs.py 를 실행하세요.")
        pages = PyPDFLoader(path).load()
        chunks = splitter.split_documents(pages)
        for c in chunks:
            c.metadata["source_tag"] = source_tag   # ★ 약관/선정기준 구분 태그
        all_docs.extend(chunks)
    vectordb = Chroma.from_documents(
        documents=all_docs,
        embedding=embeddings,
        persist_directory=PERSIST_DIR,
        collection_name=COLLECTION,
    )
    print(f"ChromaDB 생성 완료 (총 {len(all_docs)} 청크).")

retriever = vectordb.as_retriever(search_kwargs={"k": 5})

# ─────────────────────────────────────────────
# 3. 컴플라이언스 페르소나 프롬프트 
# ─────────────────────────────────────────────
prompt = ChatPromptTemplate.from_template('''
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
5. 답변 마지막에는 항상 다음 안내를 덧붙이세요:
   "※ 본 답변은 제공된 문서 기반의 일반 안내이며, 정확한 내용은 약관 원문 및 정식 상담을 통해 확인하시기 바랍니다."
6. 답변은 존댓말로, 핵심을 먼저 말한 뒤 근거 조항을 짚어주는 방식으로 친절하게 작성하세요.

[참고 문서]
{context}

[고객 질문]
{question}
''')

# ─────────────────────────────────────────────
# 4. LLM + RAG 체인 (LCEL)
# ─────────────────────────────────────────────
llm = ChatGoogleGenerativeAI(
    model=LLM_MODEL,
    temperature=0.1,
    google_api_key=os.getenv("GEMINI_API_KEY"),
)


def format_docs(docs):
    """검색된 청크를 출처 태그와 함께 하나의 문자열로 포장"""
    blocks = []
    for d in docs:
        tag = d.metadata.get("source_tag", "문서")
        page = d.metadata.get("page", "?")
        blocks.append(f"[출처: {tag} / p.{page}]\n{d.page_content}")
    return "\n\n---\n\n".join(blocks)


rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# ─────────────────────────────────────────────
# 5. Gradio 챗봇 UI
# ─────────────────────────────────────────────
def respond(message, history):
    if not LLM_MODEL:
        return "⚠️ 코드 상단의 LLM_MODEL 변수에 사용할 모델명(예: gpt-4o-mini)을 입력한 뒤 다시 실행하세요."
    try:
        return rag_chain.invoke(message)
    except Exception as e:
        return f"오류가 발생했습니다: {e}"


demo = gr.ChatInterface(
    fn=respond,
    title="🛡️ AI 보험 안내 도우미",
    description="보험 약관과 보험료 산정기준 문서를 기반으로 안내해 드립니다. (예: '35세 남성 암특약 포함하면 보험료 어떻게 산정돼?')",
    examples=[
        "이 보험의 암 보장은 언제부터 적용되나요?",
        "35세 남성이 암진단 특약을 넣으면 보험료가 어떻게 산정되나요?",
        "보험금을 못 받는 경우는 어떤 경우인가요?",
        "흡연자면 보험료가 얼마나 올라가나요?",
    ],
)

if __name__ == "__main__":
    demo.launch()
