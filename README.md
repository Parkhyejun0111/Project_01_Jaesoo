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

## RAG 챗봇 (로컬 전용)

`chromadb`, `sentence-transformers` 등 무거운 의존성과 벡터 DB 파일을 사용하므로
Vercel Serverless Function 용량 제한에 맞지 않습니다. **Vercel에는 배포되지 않습니다.**

```bash
uv sync
uv run terms_reader_agent.py
```

`.env`에 API 키가 필요합니다 (`.gitignore`에 포함되어 있어 커밋되지 않습니다).

웹으로 공개하려면 Render, Railway, Fly.io 같은 컨테이너 호스팅에 별도 배포한 뒤
프론트엔드에서 해당 API 주소를 호출하도록 연결해야 합니다.
