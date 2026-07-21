# Project_01_Jaesoo

재수생 대상 보험 서비스 프로토타입. 두 개의 독립적인 부분으로 구성됩니다.

| 구성 | 경로 | 배포 |
|---|---|---|
| 프론트엔드 (React + Vite) | `frontend/` | **Vercel** |
| 보험 약관 RAG 챗봇 (Python) | 루트 (`terms_reader_agent.py` 등) | 로컬 실행 전용 |

---

## 프론트엔드 (Vercel 배포 대상)

백엔드 호출이 없는 정적 SPA입니다.

### 로컬 실행

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # frontend/dist 생성
```

### Vercel 배포

리포지토리 루트의 `vercel.json`이 빌드 설정을 모두 담고 있어서,
Vercel 대시보드에서 **추가 설정 없이** 임포트만 하면 됩니다.

1. https://vercel.com/new 접속
2. `Parkhyejun0111/Project_01_Jaesoo` 임포트
3. Framework Preset: **Other**, Root Directory: `./` (기본값 유지)
4. Build / Output / Install Command 칸은 **모두 비워둘 것** — `vercel.json`이 덮어씁니다
5. 환경변수 **없음**
6. Deploy

`main` 브랜치에 push할 때마다 자동 재배포되고, 다른 브랜치는 프리뷰 URL이 생성됩니다.

### 배포 설정 파일

- **`vercel.json`** — `frontend/`만 `npm ci` → `vite build` 하고 `frontend/dist`를 서빙합니다.
  SPA rewrite(모든 경로 → `index.html`)와 `/assets/*` 캐시 헤더 포함.
- **`.vercelignore`** — Python 코드, 약관 PDF, 벡터 DB를 업로드 대상에서 제외합니다.
- **`frontend/package-lock.json`** — `npm ci`가 요구하므로 반드시 커밋된 상태를 유지해야 합니다.
  `frontend/package.json`의 의존성을 바꾸면 락파일도 함께 커밋하세요.

---

## AI 약관 챗봇 백엔드 — 두 가지 방식

프론트엔드 `home → AI 상담` 화면의 칩(질문)을 누르면 백엔드 `/api/chat` 를 호출해
**실제 약관 PDF(`no_jaesoo_insurance_policy_3.pdf`) 근거로 답변**합니다.
(백엔드가 꺼져 있으면 미리 준비된 예시 답변으로 자동 폴백하므로 정적 배포도 화면은 뜹니다.)

### 방식 A) 경량 RAG (권장 · Anthropic) — `main.py` + `rag_light.py`

`pypdf` 로 PDF 를 읽어 순수 파이썬 TF-IDF 로 검색하고 **Claude(claude-opus-4-8)** 로 답변을
생성합니다. `torch/chromadb` 가 필요 없어 설치가 가볍고 어디서나 실행됩니다.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-rag.txt
# .env 에 LLM_API_KEY=sk-ant-... 설정 (없으면 발췌 기반 폴백으로 동작)
python -m uvicorn main:app --port 8000      # http://localhost:8000/api/chat
```

프론트엔드는 기본적으로 `http://localhost:8000` 을 호출합니다.
다른 주소면 `frontend/.env` 에 `VITE_API_URL=https://...` 를 넣으세요.

### 방식 B) 원본 RAG (Gemini + 로컬 임베딩) — `terms_reader_agent.py`

`chromadb`, `sentence-transformers` 등 무거운 의존성을 사용합니다(로컬 Gradio UI 전용).

```bash
uv sync --extra rag
uv run terms_reader_agent.py     # .env 에 GEMINI_API_KEY 필요
```

### 프론트엔드 ↔ 백엔드 연결 요약

- `frontend/src/App.jsx` 상단 `API_BASE` 가 백엔드 주소(기본 `localhost:8000`)입니다.
- 로컬 데모: 터미널 2개로 `uvicorn main:app --port 8000` 과 `cd frontend && npm run dev` 를 함께 실행.
- 웹 공개: 백엔드를 Render/Railway/Fly.io 등에 배포하고 `VITE_API_URL` 로 그 주소를 가리키면 됩니다.
