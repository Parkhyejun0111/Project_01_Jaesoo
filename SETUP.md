# 재수없수 — 팀원용 로컬 실행 가이드

이 앱은 **프론트엔드(React)** + **백엔드(Python, AI 챗봇)** 두 개를 함께 켜야 화면이 전부 동작합니다.
터미널 2개를 씁니다.

> 사전 설치: **Node.js 18+**, **Python 3.11+** (각자 컴퓨터에 한 번만)
> - Node: https://nodejs.org  (LTS)
> - Python: https://www.python.org/downloads/

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

# ⭐ API 키 설정: .env.example 을 .env 로 복사한 뒤 키를 넣으세요
cp .env.example .env               # (Windows) copy .env.example .env
#  → .env 를 열어 OPENAI_API_KEY=sk-... 를 채웁니다. (팀 대표에게 키를 받으세요)

# 서버 실행
python -m uvicorn main:app --port 8000
```

- 확인: 브라우저에서 http://localhost:8000/api/health → `{"status":"ok","llm":true,...}`
- **키가 없어도** 앱은 돌아갑니다. 단 AI 답변이 "약관 발췌 요약(폴백)"으로만 나오고,
  키가 있으면 문장을 매끄럽게 다듬어 줍니다.

## 2) 프론트엔드 (화면) — 터미널 ②

```bash
cd Project_01_Jaesoo/frontend
npm install
npm run dev
```

- 확인: 브라우저에서 **http://localhost:5173** 접속 → 앱 화면이 뜹니다.

---

## 자주 나는 문제

- **챗봇이 "서버에 연결하지 못했어요"** → 터미널 ①(백엔드 :8000)이 켜져 있는지 확인.
- **`python3` 명령이 없다** → Windows는 보통 `python`, macOS는 `python3` 입니다.
- **포트가 이미 쓰인다** → 다른 프로그램이 5173/8000을 쓰는 중. 그 프로그램을 끄거나 포트를 바꾸세요.
- **AI 답변이 밋밋하다** → `.env` 에 유효한 `OPENAI_API_KEY` 가 있는지 확인.

## 참고
- 화면(대시보드·돈워리·성적분석 등)은 백엔드 없이도 대부분 보입니다.
  **AI 챗봇 답변만** 백엔드(:8000)가 필요합니다.
- 실제 약관 근거 문서는 `policy_full.pdf` 입니다. 다른 약관으로 바꾸려면 이 파일을 교체하세요.
