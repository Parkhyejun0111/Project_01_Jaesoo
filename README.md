# Project_01_Jaesoo

재수생 대상 보험 서비스 프로토타입. 두 개의 독립적인 부분으로 구성됩니다.

| 구성 | 경로 | 배포 |
|---|---|---|
| 프론트엔드 (React + Vite) | `frontend/` | **Vercel** |
| FastAPI 백엔드 + 경량 RAG | `main.py`, `rag_light.py` | 로컬/별도 서버 |
| 학원비 카드 영수증 검증 | `receipt_verification/` | FastAPI 백엔드에 통합 |

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

### 방식 A) 경량 RAG (권장 · OpenAI) — `main.py` + `rag_light.py`

`pypdf` 로 PDF 를 읽어 순수 파이썬 TF-IDF 로 검색하고 **OpenAI(gpt-4o)** 로 답변을
생성합니다. `torch/chromadb` 가 필요 없어 설치가 가볍고 어디서나 실행됩니다.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-rag.txt
# .env 에 OPENAI_API_KEY와 OPENAI_MODEL=gpt-4o 설정 (없으면 발췌 기반 폴백으로 동작)
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

---

## 학원비 카드 영수증 검증 백엔드

보험 가입 시 등록한 카드사·카드번호 뒤 4자리와 사용자가 제출한 학원 카드
영수증 OCR 결과를 비교합니다. 정보가 일치하면 `VERIFIED`, 누락·불일치·중복
등이 있으면 `ADDITIONAL_PROOF_REQUIRED`로 전환하고 카드사 공식 이용내역을
추가로 받을 수 있습니다.

`MATCHED`는 **등록 카드 정보와 제출 영수증 정보가 일치했다는 뜻**입니다.
카드사 API나 마이데이터 API를 호출하지 않으며, 카드사의 실제 승인 원장을
확인했다는 뜻이 아닙니다.

### 구성

- `receipt_verification/api.py`: 카드·청구·업로드 API와 Swagger 설명
- `receipt_verification/db.py`: 기존 Supabase PostgreSQL 또는 SQLite 스키마
- `receipt_verification/repositories.py`: 영속성 계층
- `receipt_verification/services/`: 카드, 청구, 문서, OCR, 검증, 이상 판정
- `receipt_verification/normalizers.py`: 카드 뒤 4자리, 금액, 날짜 등 정규화
- `tests/`: API 및 개인정보 보호 테스트

Supabase 연결 환경변수가 채워져 있으면 기존 프로젝트의 PostgreSQL 연결을
재사용합니다. `RECEIPT_DATABASE_URL`을 설정하면 그 값을 우선 사용합니다.
두 설정이 모두 없으면 `.data/receipt_verification.db` SQLite 파일을 자동으로
생성합니다. 영수증 검증 테이블은 첫 관련 API 요청에서 생성되므로, 외부 DB가
일시적으로 사용할 수 없어도 기존 챗봇·학생 API의 모듈 로드는 유지됩니다.

### Windows PowerShell 설치 및 실행

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-test.txt
Copy-Item .env.example .env
python -m uvicorn main:app --reload --port 8000
```

운영 의존성만 설치할 때는 `requirements.txt`를 사용합니다. 서버 실행 후 다음
주소에서 모든 엔드포인트와 업로드 폼을 시험할 수 있습니다.

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
- 상태 확인: `http://localhost:8000/api/health`

테스트 실행:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

### 환경변수

```dotenv
# Supabase가 설정된 프로젝트에서는 비워 두면 기존 연결을 재사용
RECEIPT_DATABASE_URL=
# Supabase 및 위 URL이 없을 때 사용하는 개발용 SQLite
RECEIPT_SQLITE_PATH=.data/receipt_verification.db
RECEIPT_UPLOAD_DIR=uploads

OCR_PROVIDER=mock
OCR_CONFIDENCE_THRESHOLD=0.80
MAX_UPLOAD_SIZE_MB=10
MAX_PAYMENT_AGE_DAYS=365

APP_ENV=development
ENABLE_MOCK_OCR_ENDPOINT=true
```

`APP_ENV=production`에서는 `ENABLE_MOCK_OCR_ENDPOINT=false`로 설정해야 합니다.
이 경우 `/api/claims/{claim_id}/mock-ocr` 라우트 자체가 등록되지 않습니다.

### Swagger에서 Mock OCR 테스트

1. `POST /api/cards`로 카드를 등록합니다. 전체 번호가 아닌 뒤 4자리만
   입력합니다.
2. 반환된 카드 `id`로 `POST /api/claims`를 호출합니다.
3. 개발·테스트 환경에서 `POST /api/claims/{claim_id}/mock-ocr`를 호출합니다.
4. `GET /api/claims/{claim_id}/verification` 또는
   `GET /api/claims/{claim_id}`로 결과를 확인합니다.

정상 거래 예시:

```json
{
  "card_last4": "4821",
  "payment_amount": "15,000,000원",
  "payment_date": "2026. 07. 24",
  "approval_number": "1234-5678",
  "merchant_name": " OO기숙학원 ",
  "business_number": "123-45-67890",
  "confidence_score": 0.97
}
```

등록 카드 뒤 4자리가 `4821`이고 날짜가 유효하면 `MATCHED` 및 `VERIFIED`가
됩니다. 날짜는 실행일 기준 미래가 아니고 `MAX_PAYMENT_AGE_DAYS` 이내여야
합니다.

이상 거래 예시는 위 요청에서 `card_last4`를 `1111`로 바꾸거나
`approval_number`를 비우거나 `confidence_score`를 `0.79`로 낮추면 됩니다.
결과는 `REVIEW_REQUIRED` 및 `ADDITIONAL_PROOF_REQUIRED`입니다. 이후
`POST /api/claims/{claim_id}/additional-proof`로 카드사 이용내역 이미지 또는
PDF를 제출하면 자동 원장 대조 없이 `MANUAL_REVIEW`로 전환됩니다.

실제 영수증 파일 흐름은 `POST /api/claims/{claim_id}/receipt`를 사용합니다.
JPG/JPEG/PNG/PDF만 허용하며 파일 헤더, MIME 유형, 크기를 확인합니다. 파일은
UUID 이름으로 저장하고 SHA-256 해시를 기록하여 다른 청구의 동일 파일을
탐지합니다.

### 실제 OCR 연결 위치

`receipt_verification/services/ocr.py`의 `OCRProvider` 프로토콜을 구현한 뒤
`build_container()`에서 공급자를 선택하도록 연결하면 됩니다.
`ExternalOCRProvider`는 현재 의도적으로 `503`을 반환하는 확장 지점이며,
실제 OCR API가 구현된 것처럼 동작하지 않습니다. 공급자 결과는 저장 전에
항상 별도 정규화·민감정보 마스킹 단계를 거칩니다.

### 개인정보 보호 주의사항

- 카드 등록 API는 전체 카드번호, 유효기간, CVC 같은 추가 필드를 거절합니다.
- DB에는 카드사와 카드번호 뒤 4자리만 저장합니다.
- OCR이 전체 카드번호나 CVC를 반환해도 `raw_text` 저장 전 마스킹합니다.
- 원본 파일명에 전체 카드번호 형태가 있으면 저장 전에 마스킹합니다.
- 업로드 파일에는 개인정보가 포함될 수 있으므로 운영 환경에서는
  `RECEIPT_UPLOAD_DIR`에 접근 통제, 저장 암호화, 보존 기간 및 안전한 삭제
  정책을 별도로 적용해야 합니다.
