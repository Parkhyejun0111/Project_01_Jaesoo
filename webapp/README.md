# webapp — 웹의 앱(모바일) 버전

`web` 과 **같은 화면 코드**를 폰 폭에 맞춰 배치한 별도 배포본입니다.
`Hyejun_webapp` 이라는 이름으로 바탕화면 작업 폴더에서도 보입니다(심볼릭 링크).

```
webapp/
├─ src/main.jsx      web/src/App.jsx 를 <App appMode /> 로 마운트
├─ src/app.css       앱 셸(폰 폭 고정 · 바운스 방지 · 탭 하이라이트 제거)
├─ icons/            PWA 아이콘 (빌드 때 dist 로 들어감)
├─ vite.config.js    publicDir 를 web/public 으로 가리켜 자산을 공유
└─ vercel.json       SPA rewrite · 캐시 헤더
```

## 왜 코드를 복사하지 않았나

문구·요율·가입 플로우가 두 벌이 되면 한쪽만 고쳐지고 갈라집니다.
(실제로 이 저장소가 그 문제로 하루치 작업을 잃은 적이 있습니다.)

그래서 화면 코드는 `web/src/App.jsx` **한 벌**만 두고, 레이아웃이 갈리는
지점에서만 `appMode` prop 으로 분기합니다.

- **App.jsx 의 `appMode` 분기** — 인라인 스타일은 CSS 로 덮을 수 없어
  레이아웃 자체가 달라지는 곳(그리드 열 수·패딩·상단바 구성)은 여기서 나눕니다.
- **`web/src/index.css` 의 `.app-mode` 규칙** — 인라인 스타일로 표현할 수 없는
  것(스크롤 스냅·고정 탭바·hover 제거)만 맡습니다.

`appMode` 를 켜지 않으면 기존 웹과 **픽셀 단위로 동일**합니다(스크린샷 비교로 확인).

## 앱 모드에서 달라지는 것

| 구간 | 웹 | 앱 |
|---|---|---|
| 상단 유틸바(고객센터·로그인) | 표시 | 숨김 |
| 글로벌 내비 | 로고 옆 한 줄 | 로고 아래 가로 스크롤 |
| 패스 혜택 밴드 | 4개 가로 나열 | 2×2 그리드 |
| 대표 강사 라인업 | 6열 그리드 | 스와이프 캐러셀(카드 62vw) |
| 합격 후기 | 3열 그리드 | 스와이프 캐러셀(카드 80vw) |
| 청약서 상품 선택 | 4열 | 2열 |
| 하단 | — | 고정 탭바(홈·인강·보험·MY) |

## 로컬 실행

```bash
npm install            # 저장소 루트에서 한 번
npm run dev:webapp     # http://localhost:5174
```

백엔드는 `web` 과 같습니다. `.env` 없이 뜨고, 없으면 `http://localhost:8000` 을 봅니다.

```bash
cp .env.example .env   # VITE_API_URL
```

## 배포

Vercel 프로젝트 `jaesoo-webapp`, Root Directory `webapp`.

```bash
cd ~/dev/jaesoo-insurance
VERCEL_ORG_ID=... VERCEL_PROJECT_ID=... ./node_modules/.bin/vercel --prod --yes
```

> Root Directory 가 설정된 프로젝트는 **저장소 루트에서** 배포해야 합니다.
> `vercel --cwd webapp` 은 경로가 `webapp/webapp` 으로 겹쳐 실패합니다.

환경변수는 `VITE_API_URL`(필수) · `VITE_APP_URL`(가입 완료 후 앱으로 보내는 링크).
**Vite 변수는 빌드 시점에 박히므로 값을 바꾸면 재배포해야 합니다.**
