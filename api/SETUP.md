# 재수없수 — 팀원용 로컬 실행 가이드

이 앱은 **프론트엔드(React)** + **백엔드(Python, AI 챗봇)** 두 개를 함께 켜야 화면이 전부 동작합니다.
터미널 2개를 씁니다.

> 사전 설치: **Node.js 18+**, **Python 3.11+** (각자 컴퓨터에 한 번만)
> - Node: https://nodejs.org  (LTS)
> - Python: https://www.python.org/downloads/

---

## ⚡ 이미 설치를 마쳤다면 — 다시 실행할 때

설치·키 설정은 처음 한 번만 하면 됩니다. **두 번째부터는 아래 두 줄이 전부입니다.**

```powershell
# 터미널 ① 백엔드
cd Project_01_Jaesoo
.\run-backend.ps1                           # 8000부터 사용 가능한 포트를 자동 선택
```

```powershell
# 터미널 ② 프론트엔드
cd Project_01_Jaesoo\frontend
npm run dev
```

- 접속: **http://localhost:5173/** (웹 화면) · **http://localhost:5173/app** (모바일 앱 화면)
- 끄기: 각 터미널에서 **Ctrl+C**
- 백엔드 포트가 `8000`이 아니면 실행 화면에 표시되는 Swagger 주소를 사용하세요.
- PowerShell 실행 정책 오류가 나면 `powershell -ExecutionPolicy Bypass -File .\run-backend.ps1`로 실행하세요.

> 코드를 고쳤을 때
> - **파이썬**(`main.py`·`engine.py`·`rag_light.py`) → 백엔드를 **재시작**해야 반영됩니다.
>   자주 고칠 거면 `--reload` 를 붙이면 자동 재시작됩니다.
> - **화면**(`App.jsx`) → 저장만 하면 브라우저에 즉시 반영. 재시작 불필요.
> - **`.env`** → 서버가 뜰 때 한 번만 읽으므로 백엔드 재시작 필요.

아래는 **처음 한 번** 하는 설치 과정입니다.

---

## 1) 백엔드 (AI 챗봇) — 터미널 ①

```bash
# 압축 푼 폴더로 이동
cd Project_01_Jaesoo

# 가상환경 만들고 활성화
python3 -m venv .venv
source .venv/bin/activate          # (Windows) .venv\Scripts\activate

# 필요한 패키지 설치 (가벼움: torch/chromadb 없음)
pip install -r requirements-rag.txt

# ⭐ API 키 설정 — .env 는 저장소에 올라가지 않으므로 각자 만들어야 합니다.
cp .env.example .env      # (Windows) copy .env.example .env
#   그 다음 .env 를 열어 OPENAI_API_KEY 와 SUPABASE_DB_* 를 채우세요.
#   키는 팀 대표에게 받으세요. 절대 커밋하지 마세요.

# 서버 실행
python -m uvicorn main:app --port 8000
```

- 확인: 브라우저에서 http://localhost:8000/api/health → `{"status":"ok","llm":true,...}`
- 키를 넣으면 AI 챗봇·개인화(Supabase)까지 그대로 동작합니다.
  (키가 없어도 화면은 뜨지만, AI 답변이 "약관 발췌 요약(폴백)"으로만 나옵니다.)

## 2) 프론트엔드 (화면) — 터미널 ②

```bash
cd Project_01_Jaesoo/frontend
npm install
npm run dev
```

- 접속 주소는 **두 개**입니다 (같은 서버, 경로만 다름):
  - **http://localhost:5173/**  → 인강 결제·보험 청약 **웹 화면** (데스크톱)
  - **http://localhost:5173/app** → 재수없수 **모바일 앱 화면** (로그인부터)

---

## AI 모델 바꾸기

챗봇이 쓸 모델은 `.env` 의 **`LLM_PROVIDER` 한 줄**로 정합니다. 바꾼 뒤 백엔드를 재시작하세요.

```bash
LLM_PROVIDER=openai      # openai | anthropic | deepseek | grok | gemini | auto
```

| 값 | 필요한 키 | 비고 |
|---|---|---|
| `openai` | `OPENAI_API_KEY` | 유료 |
| `gemini` | `GEMINI_API_KEY` | **무료 티어 있음** (https://aistudio.google.com/apikey) |
| `anthropic` | `LLM_API_KEY` | 유료 |
| `deepseek` | `DEEPSEEK_API_KEY` | 유료 (크레딧 없으면 402) |
| `grok` | `GROK_API_KEY` | 콘솔에서 데이터 공유를 켜면 무료 크레딧 |
| `auto` | — | 키가 있는 것 중 위 순서대로 자동 선택 |

지금 무엇이 쓰이는지는 http://localhost:8000/api/health 에서 확인합니다.

```json
{"status":"ok","llm":true,"provider":"openai","model":"openai:gpt-4o","available":["openai","gemini"],"db":true}
```

- `provider` = 지금 실제로 쓰는 회사, `model` = 실제 모델명, `available` = 키가 채워진 회사 전체
- `provider` 가 `fallback` 이면 쓸 수 있는 키가 없다는 뜻입니다.
- LangSmith에서는 `openai_compatible_chat` 하위 실행에 실제 입력·출력 토큰과 비용이 기록됩니다.

## 자주 나는 문제

- **챗봇이 "서버에 연결하지 못했어요"** → 터미널 ①(백엔드 :8000)이 켜져 있는지 확인.
- **`python3` 명령이 없다** → Windows는 보통 `python`, macOS는 `python3` 입니다.
- **포트가 이미 쓰인다** → 다른 프로그램이 5173/8000을 쓰는 중. 그 프로그램을 끄거나 포트를 바꾸세요.
- **AI 답변이 밋밋하다 (약관 발췌만 나온다)** → LLM 호출이 실패해 폴백된 상태입니다.
  `/api/chat` 응답의 `error` 필드에 이유가 담겨 옵니다. 크레딧 부족(402/403)이 흔한 원인이에요.
- **코드를 고쳤는데 그대로다** → 파이썬은 백엔드 재시작이 필요합니다(위 ⚡ 항목 참고).

## 참고
- 화면(대시보드·돈워리·성적분석 등)은 백엔드 없이도 대부분 보입니다.
  **AI 챗봇 답변만** 백엔드(:8000)가 필요합니다.
- 실제 약관 근거 문서는 `policy_full.pdf` 입니다. 다른 약관으로 바꾸려면 이 파일을 교체하세요.
