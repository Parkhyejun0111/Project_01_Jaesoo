# 재수없수 — 인강 임베디드 교육보험

원래 4개 폴더(`hyejun_llm_donworry` · `jaehee_app` · `Jihyun_web` · `mirae_QR`)로 흩어져 있던
코드를 하나의 서비스로 통합한 저장소입니다. 원본 폴더는 상위 디렉터리에 그대로 보존돼 있습니다.

```
jaesoo-insurance/
├─ api/                  FastAPI 백엔드 (요율 엔진 · 약관 RAG · 영수증 검증)
│  └─ policy/            약관 HTML — 단일 진실. 프론트는 빌드 시 사본을 받는다
├─ web/                  인강 임베디드 가입 웹 (Vite + React 18)
├─ app/                  보호자용 모바일 앱 (Next 16 + React 19)
├─ packages/api-client/  웹·앱 공유 API 클라이언트
├─ scripts/              약관 동기화 · 자산 점검
├─ docs/actuarial/       계리 노트북·고객용 표 (참조용)
└─ _archive/legacy-spa/  구 통합 SPA (로직 도너, 배포 대상 아님)
```

## 로컬 실행

### 1) 백엔드
```bash
cd api
python3 -m venv .venv && ./.venv/bin/python -m pip install -r requirements-test.txt -r requirements.txt
cp .env.example .env          # 키는 선택 — 없어도 기동한다
./.venv/bin/python -m uvicorn main:app --port 8000
```
`.env` 없이도 뜹니다. LLM 키가 없으면 챗봇이 약관 발췌로 답하고, Supabase 가 없으면
학생 개인화만 꺼집니다. `http://localhost:8000/docs` 에서 전체 API 를 확인할 수 있습니다.

시드 데이터(학생 6명): `./.venv/bin/python seed_supabase.py` — Supabase 설정이 필요합니다.

### 2) 웹 (http://localhost:5173)
```bash
npm install          # 저장소 루트에서 한 번 (워크스페이스)
npm run dev:web
```

### 3) 앱 (http://localhost:3000)
```bash
npm run dev:app
```

웹에서 가입을 마치면 완료 화면의 "앱에서 내 계약 보기" 버튼이
`?student_id=...` 를 달아 앱을 열고, 앱은 그 계약을 바로 불러옵니다.

## 테스트
```bash
cd api && ./.venv/bin/python -m pytest -q      # 242개
cd app && npx tsc --noEmit && npm run build
```

## 배포 (Vercel 3 프로젝트, 같은 저장소)

| 프로젝트 | Root Directory | 필수 환경변수 |
|---|---|---|
| api | `api` | `LLM_PROVIDER`·키, `SUPABASE_DB_*`, **`RECEIPT_STORAGE`** |
| web | `web` | `VITE_API_URL`, `VITE_APP_URL` |
| app | `app` | `NEXT_PUBLIC_API_URL` |

**주의**
- Vite 환경변수는 **빌드 시점에 박힙니다.** 배포 전에 반드시 설정하세요.
- `RECEIPT_STORAGE=local` 로 두면 Vercel 에서 청구 플로우가 동작하지 않습니다.
  Functions 는 요청 간 디스크가 유지되지 않으므로 `vercel-blob` 또는 `supabase` 를 쓰세요.
- 운영에서는 `APP_ENV=production` + `ENABLE_MOCK_OCR_ENDPOINT=false`.

## 위치와 임시 자산

이 저장소는 **`~/dev/jaesoo-insurance`** 에 있습니다. 원본 소스인
`~/Desktop/아카이브/` 는 iCloud Drive 동기화 폴더라, 큰 이미지·폰트가 아직
내려받아지지 않은 상태(`SF_DATALESS`)면 그 파일을 읽는 순간 **빌드가 CPU 0% 로
무한정 멈춥니다.** 그래서 작업본을 iCloud 밖으로 옮겼습니다.
(원본 `아카이브/` 는 손대지 않았습니다 — 그쪽에 쓰면 클라우드 원본이 덮어써집니다.)

웹 자산(폰트 3종·강사 카드 6장·마스코트)은 **원본으로 모두 교체 완료**했습니다.
앱 로고·일러스트 9개만 아직 임시 자산입니다. 무엇을 바꿔야 하는지는
**`ASSETS-TODO.md`** 에 정리돼 있고, 남은 임시 파일은 이렇게 찾습니다.

```bash
find . -name '*.placeholder' -not -path './node_modules/*'
```

`npm run build` 는 시작 전에 내려받지 않은 파일을 점검해 즉시 알려줍니다
(`scripts/check-assets.mjs`).
