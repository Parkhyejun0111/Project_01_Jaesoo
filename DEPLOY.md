# Vercel 배포

## 현재 운영 중 — `Hyejun_727` 브랜치

| 프로젝트 | URL | Root Directory | 빌드 |
|---|---|---|---|
| `project-01-jaesoo` (앱) | https://project-01-jaesoo.vercel.app | `.` | `npm run build:app` → `app/.next` |
| `jaesoo-api-hyejun727` | https://jaesoo-api-hyejun727.vercel.app | `api` | `pip install -r requirements.txt` |
| `jaesoo-web-hyejun727` | https://jaesoo-web-hyejun727.vercel.app | `.` | `npm run build:web` → `web/dist` |
| `jaesoo-webapp-hyejun727` | https://jaesoo-webapp-hyejun727.vercel.app | `.` | `npm run build:webapp` → `webapp/dist` |

앱·웹·웹앱은 Root Directory 가 `.` 다. `webapp` 은 `../web/public` 을, `app` 은
워크스페이스 패키지 `packages/api-client` 를 참조해서 하위 폴더만 올리면 빌드가
깨진다 — 저장소 루트에서 워크스페이스 빌드를 돌려야 한다.

네 프로젝트 모두 이 저장소에 연결돼 있고 **Production Branch 가 `Hyejun_727`** 이다.
`Hyejun_727` 에 푸시하면 넷이 각자 빌드해 프로덕션까지 올라간다. 다른 브랜치에
푸시하면 프리뷰만 생긴다. Production Branch 는 CLI 로 못 바꾼다 —
Settings → Environments → Production → Branch Tracking 에서만 된다.

> 기존 `jaesoo-api` 프로젝트도 Production Branch 가 `Hyejun_727` 로 바뀌어 있어
> 같은 코드가 https://jaesoo-api.vercel.app 에도 올라간다. 프런트 3개가 부르는
> 곳은 `jaesoo-api-hyejun727` 이므로, 둘 중 하나를 정리하는 게 낫다.

> ⚠️ **`jaesoo-api-hyejun727` 은 Root Directory 가 `api` 다.** CLI 로 수동 배포할
> 때도 **저장소 루트에서** 해야 한다. `cd api && vercel deploy` 로 하면 Vercel 이
> 업로드된 `api/` 를 루트로 잡고 거기서 다시 `api/` 로 내려가 `api/api/` 를
> 프로젝트 루트로 착각한다 → 500 `FUNCTION_INVOCATION_FAILED`.
> (실제로 이렇게 한 번 죽였다)

앱의 `NEXT_PUBLIC_API_URL`, 웹·웹앱의 `VITE_API_URL` 은 모두 위 api 주소를 가리킨다.

### 무료 플랜 배포 한도

Hobby 플랜은 **하루 100회**다(`api-deployments-free-per-day`). 푸시 한 번에 연결된
프로젝트가 동시에 빌드되므로 한 번 푸시 = 배포 3~4회로 계산된다. 넘기면
`Resource is limited - try again in 24 hours` 로 배포가 아예 생성되지 않는다.
리셋은 한국 자정이 아니라 UTC 기준이다(KST 오전 9시경).

---

## 레거시 — `Final_02` 브랜치

아래는 `Final_02` 를 프로덕션으로 쓰는 기존 4개 프로젝트 구성이다.

같은 저장소(`Final_02` 브랜치)로 **4개 프로젝트**를 만듭니다. Root Directory 만 다릅니다.

| 프로젝트 | Root Directory | Framework | 결과 |
|---|---|---|---|
| `jaesoo-api` | `api` | Other | FastAPI (Python 서버리스 함수) |
| `jaesoo-web` | `web` | Vite | 인강 임베디드 가입 웹 (데스크톱) |
| `jaesoo-webapp` | `webapp` | Vite | 같은 웹의 앱(모바일) 화면 |
| `jaesoo-app` | `app` | Next.js | 보호자용 모바일 앱 |

> **순서가 중요합니다.** 웹·웹앱·앱이 백엔드 주소를 빌드 시점에 박으므로
> **api 를 먼저 배포**해 URL 을 얻은 뒤 나머지를 배포하세요.

## 자동 배포 (Git 연동)

4개 프로젝트 모두 이 저장소에 연결돼 있고 **프로덕션 브랜치는 `Final_02`** 입니다.
`Final_02` 에 푸시하면 4개가 각자 Root Directory 를 빌드해 프로덕션까지 올라갑니다.
다른 브랜치에 푸시하면 프리뷰 배포만 생깁니다.

```bash
git push origin Final_02      # → api · web · webapp · app 자동 배포
```

> `main` 은 통합 전의 초기 RAG 챗봇 프로젝트가 그대로 있는 **별개 갈래**입니다
> (Final_02 와 공통 조상이 없습니다). 서비스 코드는 `Final_02` 가 기준이라
> 프로덕션 브랜치를 그쪽으로 맞춰 두었습니다. `main` 으로 옮기려면 브랜치를
> 합친 뒤 각 프로젝트의 Settings → Git → Production Branch 를 바꾸세요.

---

## 수동 배포 (CLI)

> ⚠️ **Root Directory 가 설정된 프로젝트는 저장소 루트에서 배포합니다.**
> `vercel --cwd web` 처럼 하위 폴더를 지정하면 경로가 `web/web` 으로 겹쳐
> 실패하고, api 는 `vercel.json` 을 못 찾아 **배포가 깨집니다**(실제로 한 번
> 프로덕션이 500 으로 내려갔습니다). 프로젝트 지정은 환경변수로 합니다.
>
> ```bash
> cd ~/dev/jaesoo-insurance
> VERCEL_ORG_ID=<orgId> VERCEL_PROJECT_ID=<projectId> \
>   ./node_modules/.bin/vercel --prod --yes
> ```
>
> `orgId`·`projectId` 는 각 폴더의 `.vercel/project.json` 에 있습니다.
> 루트에서 그냥 `vercel` 을 치면 **새 프로젝트가 만들어지니** 주의하세요.

---

## 1) api — 먼저 배포

Vercel 대시보드 → Add New → Project → 이 저장소 Import
- **Root Directory**: `api`
- **Framework Preset**: Other
- Build/Output/Install 은 비워 둡니다 (`vercel.json` 이 담당)

### 환경변수

| 키 | 값 | 없으면 |
|---|---|---|
| `LLM_PROVIDER` | `openai` 또는 `anthropic` 등 | 챗봇이 약관 발췌로만 답함 |
| `OPENAI_API_KEY` / `LLM_API_KEY` | 해당 프로바이더 키 | 〃 |
| `SUPABASE_DB_HOST` | Supabase → Database → Connection pooling 호스트 | 학생 개인화 기능 꺼짐 |
| `SUPABASE_DB_PORT` | `6543` | |
| `SUPABASE_DB_USER` / `SUPABASE_DB_PASSWORD` | | |
| `SUPABASE_DB_NAME` | `postgres` | |
| **`RECEIPT_STORAGE`** | **`vercel-blob`** | ⚠️ `local` 이면 청구 플로우가 동작하지 않음 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Storage → Blob 생성 시 자동 주입 | |
| `APP_ENV` | `production` | |
| `ENABLE_MOCK_OCR_ENDPOINT` | `false` | 운영에서 mock OCR 라우트 비활성화 |

배포 후 확인:
```
https://<api-도메인>/api/health     → {"status":"ok", ...}
https://<api-도메인>/docs           → Swagger UI
```

### ⚠️ 업로드 저장소를 꼭 바꿔야 하는 이유
Vercel Functions 는 요청 간 파일시스템이 유지되지 않습니다. `RECEIPT_STORAGE=local`
이면 영수증을 올린 직후를 빼고 모든 조회가 실패합니다.
Vercel Storage 에서 Blob 을 만들어 프로젝트에 연결하면 `BLOB_READ_WRITE_TOKEN` 이
자동으로 주입됩니다. Supabase Storage 를 쓰려면 `RECEIPT_STORAGE=supabase` +
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `RECEIPT_BUCKET`.

---

## 2) web

- **Root Directory**: `web`
- **Framework Preset**: Vite

### 환경변수
| 키 | 값 |
|---|---|
| `VITE_API_URL` | 1) 에서 얻은 api 도메인 (예: `https://jaesoo-api.vercel.app`) |
| `VITE_APP_URL` | 3) 에서 얻을 app 도메인 — 처음엔 비워 두고 나중에 채운 뒤 재배포 |

> **Vite 환경변수는 빌드 시점에 번들에 박힙니다.** 값을 바꾸면 반드시 재배포해야 합니다.

---

## 2-1) webapp — 웹의 앱 화면

- **Root Directory**: `webapp`
- **Framework Preset**: Vite

화면 코드는 `web/src/App.jsx` 한 벌을 그대로 쓰고 `appMode` 로 레이아웃만 바꿉니다
(자세한 내용은 `webapp/README.md`). 정적 자산도 `web/public` 을 공유하므로
**Root Directory 밖의 파일이 필요합니다.** 설치·빌드 오류가 나면
Settings → Build & Development → *Include source files outside of the Root Directory* 를 켜세요.

### 환경변수
| 키 | 값 |
|---|---|
| `VITE_API_URL` | 1) 에서 얻은 api 도메인 |
| `VITE_APP_URL` | 3) 에서 얻은 app 도메인 |

---

## 3) app

- **Root Directory**: `app`
- **Framework Preset**: Next.js

### 환경변수
| 키 | 값 |
|---|---|
| `NEXT_PUBLIC_API_URL` | 1) 에서 얻은 api 도메인 |

배포 후 web 프로젝트의 `VITE_APP_URL` 에 app 도메인을 넣고 web 을 **재배포**하면
가입 완료 화면의 "앱에서 내 계약 보기" 버튼이 연결됩니다.

---

## CLI 로 배포하는 경우

```bash
cd ~/dev/jaesoo-insurance
./node_modules/.bin/vercel login          # 브라우저 인증 (직접 실행 필요)

./node_modules/.bin/vercel --cwd api  --prod
./node_modules/.bin/vercel --cwd web  --prod
./node_modules/.bin/vercel --cwd app  --prod
```

## 모노레포 주의

`web` · `app` 은 워크스페이스 패키지 `@jaesoo/api-client` 에 의존합니다.
Vercel 은 저장소 루트의 `package-lock.json` 을 보고 npm workspaces 를 자동 인식하지만,
설치 오류가 나면 프로젝트 설정에서
**Settings → Build & Development → "Include source files outside of the Root Directory"** 를 켜세요.

## 현재 상태

- 앱 이미지 9개는 아직 임시 자산입니다 (`ASSETS-TODO.md`). 배포는 정상 동작하고
  로고·아이콘 자리에 줄무늬 이미지가 보입니다.
- Supabase 미설정 시: 웹은 티어표 폴백으로 정상 표시, 앱은 로그인 화면에
  "등록된 계약이 없어요" 안내가 뜹니다. 챗봇·약관·돈워리 계산기는 DB 없이도 동작합니다.
