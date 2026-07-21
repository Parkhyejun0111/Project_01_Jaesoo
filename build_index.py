"""약관 PDF -> 임베딩 인덱스 사전 계산 (로컬에서 한 번만 실행).

Vercel 서버리스는 디스크에 쓸 수 없고 함수 용량 제한(250MB)도 있어서,
ChromaDB를 런타임에 생성할 수 없다. 대신 여기서 임베딩을 미리 계산해
index.npz + chunks.json 으로 저장하고, 그 두 파일을 레포에 커밋한다.
서버는 그 파일만 읽어서 numpy 코사인 유사도로 검색한다.

실행:
    uv sync --extra index
    python build_index.py
"""

import json
import os
import time

import numpy as np
import voyageai
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

# 넣을 PDF 파일들: (파일경로, 문서종류 태그)
PDF_SOURCES = [
    ("no_jaesoo_insurance_policy_3.pdf", "약관"),
]

EMBED_MODEL = "voyage-4-large"  # 다국어 검색 품질 최상 (한국어 포함)

# Voyage 무료 등급은 3 RPM / 10K TPM 으로 묶여 있다. 결제수단을 등록하면
# 한도가 크게 올라가므로, 그 경우 BATCH_SIZE 를 키우고 SLEEP_SECONDS 를 0 으로.
BATCH_SIZE = 16
SLEEP_SECONDS = 30
MAX_RETRIES = 5

INDEX_PATH = "index.npz"
CHUNKS_PATH = "chunks.json"


def load_chunks():
    """PDF를 읽어 청크 리스트로 만든다."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=80)
    chunks = []
    for path, source_tag in PDF_SOURCES:
        if not os.path.exists(path):
            raise FileNotFoundError(f"PDF 없음: {path}")
        pages = PyPDFLoader(path).load()
        for doc in splitter.split_documents(pages):
            chunks.append(
                {
                    "text": doc.page_content,
                    "source_tag": source_tag,
                    "page": doc.metadata.get("page", "?"),
                }
            )
    return chunks


def _embed_batch(client, batch):
    """배치 하나를 임베딩한다. 속도 제한에 걸리면 대기 후 재시도."""
    for attempt in range(MAX_RETRIES):
        try:
            return client.embed(batch, model=EMBED_MODEL, input_type="document")
        except voyageai.error.RateLimitError:
            if attempt == MAX_RETRIES - 1:
                raise
            wait = SLEEP_SECONDS * (attempt + 2)
            print(f"    속도 제한 - {wait}초 대기 후 재시도 ({attempt + 1}/{MAX_RETRIES})")
            time.sleep(wait)


def embed_documents(client, texts):
    """문서 청크를 배치로 임베딩한다."""
    vectors = []
    batches = range(0, len(texts), BATCH_SIZE)
    for n, i in enumerate(batches):
        if n > 0:
            time.sleep(SLEEP_SECONDS)  # 무료 등급 RPM/TPM 한도 준수
        result = _embed_batch(client, texts[i : i + BATCH_SIZE])
        vectors.extend(result.embeddings)
        print(f"  임베딩 {min(i + BATCH_SIZE, len(texts))}/{len(texts)}")
    return np.array(vectors, dtype=np.float32)


def main():
    if not os.getenv("VOYAGE_API_KEY"):
        raise RuntimeError("VOYAGE_API_KEY 가 설정되지 않았습니다 (.env 확인)")

    print("PDF 로드 및 청크 분할 중...")
    chunks = load_chunks()
    print(f"청크 {len(chunks)}개 생성.")

    print(f"Voyage({EMBED_MODEL}) 임베딩 중...")
    client = voyageai.Client()
    embeddings = embed_documents(client, [c["text"] for c in chunks])

    # 코사인 유사도를 내적으로 계산할 수 있도록 미리 정규화해 둔다.
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)

    np.savez_compressed(INDEX_PATH, embeddings=embeddings)
    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False)

    size_mb = os.path.getsize(INDEX_PATH) / 1024 / 1024
    print(f"완료: {INDEX_PATH} ({size_mb:.1f}MB), {CHUNKS_PATH}")
    print("두 파일을 git에 커밋하세요.")


if __name__ == "__main__":
    main()
