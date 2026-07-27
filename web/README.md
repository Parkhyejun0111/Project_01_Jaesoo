# 프론트앤드-웹 — 인강사이트 임베디드 보험 웹

`frontend/src/App.jsx`(웹+앱 혼재, 3,319줄)에서 **웹 화면만** 떼어낸 독립 프로젝트입니다.
앱(재수없수 모바일) 화면과 개인화·AI챗봇 코드는 들어 있지 않습니다.

## 담고 있는 화면 (6단계)

| entry | 화면 | 내용 |
|---|---|---|
| `landing` | 메가에듀패스 인강 홈 | 히어로 배너(자동 전환), 강사 카드, 재수비용 안내, 티어 비교표, FAQ |
| `insurance` | 보험 소개 | 보장 대상·보험료 산정·지급제한 요약, 가입 흐름 4단계, 청약 준비물, 약관 원문 링크 |
| `tiers` | 보험 상품 선택 | 라이트 / 스탠다드 / 플러스 / 프리미엄 비교·선택 |
| `terms` | 약관·상품설명 확인 | 필수/선택 동의 |
| `apply` | 보험 청약서 작성 | 계약관계자 · 가입자격 · 고지사항 · 요율문항 · 응시과목선언 · 개인정보동의 · 자필서명 |
| `done` | 가입 완료 | 가입 정보 확인 + **안드로이드/iOS 앱 설치 버튼** |

`pay`(인강 강의 결제) 화면 코드도 포함돼 있지만 **현재 도달할 수 없습니다** → 아래 "알려진 이슈" 참고.

## 실행

```bash
npm install
cp .env.example .env        # 백엔드 주소 설정 (선택)
npm run dev                 # http://localhost:5173
npm run build               # dist/ 생성
```

## 백엔드 연결

백엔드는 이 폴더 바깥의 **FastAPI(`main.py`)** 입니다. 웹 화면이 호출하는 엔드포인트는 2개뿐입니다.

| 호출 | 시점 | 백엔드가 없을 때 |
|---|---|---|
| `GET /api/tiers` | 첫 진입 시 티어 비교표 | `App.jsx` 의 `tierFallback` 정적 표로 자동 대체 (화면 정상) |
| `POST /api/enroll` | 청약서 제출 | 가입완료 화면까지는 진행되지만 **DB 저장 안 됨** (`enrolledId: null`) |

주소는 `VITE_API_URL` 환경변수로 지정하고, 없으면 `http://localhost:8000` 을 씁니다
(`src/App.jsx` 상단 `API_BASE`). Vite 환경변수는 **빌드 시점에 박히므로**, 배포할 때도
빌드 전에 반드시 설정해야 합니다.

```bash
# 로컬: 터미널 ① 백엔드
cd ..            # 프로젝트 루트 (main.py 가 있는 곳)
python -m uvicorn main:app --port 8000
# 터미널 ② 이 폴더
npm run dev
```

`GET /api/tiers` 응답 형태 (`engine.tier_table()`):

```json
{"tiers": [{"tier": "라이트", "form": "독학재수",
            "cover_mild": 2100000, "cover_sev": 4200000, "monthly_premium": 1912}, ...]}
```

웹 화면은 이 중 `tier · form · cover_mild · cover_sev · monthly_premium` 5개 필드만 씁니다.

## 파일 구조

```
프론트앤드-웹/
├─ index.html
├─ vite.config.js         # base: "./" (하위 경로 배포 가능)
├─ .env.example           # VITE_API_URL
├─ src/
│  ├─ main.jsx            # React 진입점
│  ├─ index.css           # Koddi UD 온고딕 @font-face + 전역 스타일
│  └─ App.jsx             # 웹 화면 전체 (1,325줄)
└─ public/
   ├─ jaesoo_character.png
   ├─ fonts/              # KoddiUDOnGothic 3종
   ├─ instructors/        # 랜딩 강사 카드 6장 (실제 참조되는 것만)
   └─ policy/             # 약관 원문 · 청약서 양식 HTML (새 창으로 열림)
```

`public/instructors/` 는 원본 35장 중 **실제 코드가 참조하는 6장만** 가져왔습니다.

## 원본에서 잘라낸 기준

원본 `frontend/src/App.jsx` 는 `state.mode` 값(`'web'` / `'app'`)으로 두 앱을 한 파일에서
분기하고 있었습니다. `render()` 최상위 블록 경계는 다음과 같습니다.

| 원본 줄 | 블록 | 이 프로젝트 |
|---|---|---|
| 1031–1293 | `mode==='web'` 인강 홈/랜딩 | ✅ 포함 |
| 1294–1643 | `mode==='web'` 보험 소개 | ✅ 포함 |
| **1646–1656** | `mode==='app'` 로그인 | ❌ 앱 쪽 |
| **1657–2938** | `mode==='app'` 앱 전체(홈·성적분석·돈워리·마이·AI챗봇) | ❌ 앱 쪽 |
| 2940–3302 | `mode==='web'` 결제·티어·약관·청약서·완료 | ✅ 포함 |
| 3305–3312 | 로딩 오버레이 (공용) | ✅ 포함 |

`mode` 플래그와 `navApp()` 은 제거했고, `renderVals()` 는 웹 화면이 실제로 쓰는 값
29개만 남겨 다시 작성했습니다. 함께 빠진 앱 전용 코드는 다음과 같습니다.

- 개인화: `loadStudentList` / `loginAs` / `effective` / `subjects` / 학생 성적 차트(`x1`~`y2`, `a1*`, `a2*`)
- AI 챗봇: `askLLM` / `openLlm` / `llmQA` / `RECO_QS` / `renderRich` / `openPolicy`(근거 팝업)
- 마이·성적관리: `ocrDefs` / `statusHistoryDefs` / `notifDefs` / 이의신청
- 돈워리 계산기: `costForms` / `coverOf` / `saveOptions` 등 / `chipList` / `regions`
- 앱 전용 base64 로고(`IMG_D810F4E9`, 약 12KB)

**앱 프론트엔드를 추출할 때는** 위 표의 1646–2938행과 이 목록이 그대로 재료가 됩니다.
(앱은 `/api/students`, `/api/student/{id}`, `/api/chat`, `/api/policy/pages` 를 추가로 씁니다.)

## 알려진 이슈 (원본에서 그대로 넘어온 것)

1. **인강 결제 화면(`entry:'pay'`)에 도달할 수 없습니다.** `entryGo()` 첫 줄이
   `if (screen === 'pay') return;` 로 막고 있고, `entry:'pay'` 를 세팅하던
   `selectTierFromLanding()` 은 어디서도 호출되지 않습니다(원본에서도 동일). 결제 단계를
   살리려면 랜딩 티어 버튼에서 해당 함수를 호출하도록 연결해야 합니다.
2. **청약서 제출은 실패해도 가입완료 화면으로 넘어갑니다.** `submitEnroll()` 의 `catch` 가
   `entry:'done'` 으로 진행하므로, 백엔드가 꺼져 있어도 사용자에게는 성공처럼 보입니다.
   데모 목적이면 의도된 동작이지만, 실서비스에서는 오류 안내가 필요합니다.

## 검증 기록

- `npm run build` 성공 — 234KB (원본 빌드 378KB 대비 −38%)
- 6개 화면(`landing`/`insurance`/`tiers`/`terms`/`apply`/`done`) 서버 렌더링 무예외 통과
- `renderVals()` 미제공 키 접근 0건 (Proxy 런타임 검사)
- `engine.tier_table()` 응답이 `tierRows` 요구 필드를 모두 충족
