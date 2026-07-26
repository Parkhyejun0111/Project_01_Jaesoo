# 앱 ↔ 백엔드 연동 작업 정리

> 작성일: 2026-07-26
> 대상: `app/app/page.tsx` (모든 수정은 이 파일 1개에서 이뤄짐 — 백엔드·API 클라이언트·훅은 무수정)

## 배경

백엔드(FastAPI + Supabase + LLM)와 연동 인프라(공용 API 클라이언트 `packages/api-client`,
데이터 훅 `app/lib/hooks.ts`, 세션 컨텍스트 `app/lib/session-context.tsx`)는 이미 완성돼
있었지만, 앱 화면(`app/app/page.tsx`)이 이를 전혀 import 하지 않고 **전부 하드코딩
목데이터로만** 렌더링되고 있었다. 이번 작업으로 화면과 백엔드를 실제로 연결했다.

**공통 원칙**: 백엔드가 꺼져 있어도 화면은 기존 목업으로 뜬다. 모든 연결에 폴백을 남겨,
실데이터가 있으면 실데이터를, 없으면 데모 값을 보여준다.

---

## 1. 수정사항 및 결과

### 1-1. 세션 · 로그인

| 항목 | 사용 API | 내용 |
| --- | --- | --- |
| 앱 전체 세션 | — | `AppPage`를 `SessionProvider`로 감싸고 내부를 `AppShell`로 분리. 앱 어디서든 `useSession()`으로 학생 프로필·성적·보험료 조회 가능 |
| 시작 플로우 | — | 목업 바로 진입(`stage="app"`) → 스플래시 → 로그인 → 로딩 → 앱 플로우로 변경 |
| 로그인 화면 | `GET /api/students` | DB의 실제 가입 학생 목록이 선택 칩으로 표시. 선택 후 로그인하면 학생 ID가 세션(localStorage)에 저장되고 앱 전체가 개인화됨. 서버 미연결 시 "데모 데이터로 시작해요" 안내 |
| 로그아웃 | — | 세션 학생 ID 삭제(`setStudentId(null)`) 후 로그인 화면으로 |
| 웹 핸드오프 | — | 기존 `?student_id=` 쿼리 진입(가입 완료 → 앱) 로직이 세션과 그대로 연동됨. 재로그인 시 저장된 학생이 미리 선택됨 |

### 1-2. 홈 화면

| 항목 | 사용 API | 내용 |
| --- | --- | --- |
| 인사말·아바타 | `GET /api/student/{id}` | 학생 이름 실데이터 표시 |
| 현재 월 보험료 카드 | `GET /api/student/{id}` | 계리 엔진 산출 `pricing.monthly_premium` 표시 |
| 청구 배너 문구 | 세션 파생 | `useClaimInfo()` 기반 (아래 1-6 참고) |

### 1-3. 월 보험료 상세 · 가입 내역

| 항목 | 사용 API | 내용 |
| --- | --- | --- |
| 보험료 구성 | `GET /api/student/{id}/premium-breakdown` | 가짜 구성(기본 보장 + 특약 − 할인) → 실제 3분해(**위험보험료·사업비·위험마진**, 약관 별표4)로 교체 |
| 가입 내역 | `GET /api/student/{id}` | 티어·보장 한도(중증 보장금)·가입일(enrollment `created_at`) 실데이터 표시 |

### 1-4. AI 채팅 (노재수)

| 항목 | 사용 API | 내용 |
| --- | --- | --- |
| 답변 생성 | `POST /api/chat` | 키워드 매칭 가짜 응답 → 약관 RAG + LLM 실응답. `student_id`를 실어 보내 개인화 답변(본인 보험료·보장금 수치 인용) |
| 대화 이력 | 〃 | 최근 4턴을 `history`로 전송해 맥락 유지 |
| 약관 근거 | 〃 | 답변 아래 인용 조항(`sources`) 표시 |
| UX 유지 | — | 발바닥 로딩·타자 애니메이션 유지(긴 답변은 여러 글자씩 출력). 요청 경합 시 오래된 응답 무시(`stale`), 실패 시 폴백 문구 |

### 1-5. 성적분석

| 항목 | 사용 API | 내용 |
| --- | --- | --- |
| 수능 예상 백분위 추이 | `GET /api/student/{id}` (`analysis`) | 회차별 종합 백분위(`rounds` + `round_order`) + 밴드 예측치(`band.predicted_percentile`)를 마지막 예측 점으로 표시 |
| 보장 기준선 | 〃 | 하드코딩(-15점) → 약관 밴드 경증 임계값(`band.mild_threshold_percentile`) |
| 과목별 추이 차트 | 〃 | 과목별 실측 시리즈(`subjects[].series`) + 평균 등급 환산. 차트 Y축은 데이터 범위에 맞게 자동 조정 |
| 안정성 점수 | 〃 | 과목별 변동성(σ, `volatility`)을 100점 환산(σ×8 감점)해 표시. 종합 점수 = 과목 평균 |
| 집중 보완 우선순위 | 〃 | 안정성 낮은 순 상위 2과목. 4과목 외 이름에도 기본 안내 문구 폴백 |

### 1-6. 보험금 청구 (가입정보 반영)

지급 이력 DB 조회는 아직 없으므로 **가입정보에서 파생**하는 구조로 만들었다.
핵심은 `useClaimAccount()` → `useClaimInfo()` 훅 하나로 모든 청구 화면이 값을 받게 한 것.

| 항목 | 출처 | 내용 |
| --- | --- | --- |
| 총 보장 한도 | `pricing.cover_severe` | 고정 1,400만원 → 학생 티어별 중증 보장금 (예: 스탠다드 840만원) |
| 경증 보장금 | `pricing.cover_mild` | 보장 자격 판정 화면의 경증 한도에 반영 |
| 1차 기지급액 | 파생 (한도 × 26%) | `FIRST_CLAIM_DEMO_RATIO` 데모 비율. **잔여 = 한도 − 기지급**, 진행률도 실제 비율 계산 → 기지급·잔여가 더 이상 동일하게 나오지 않음 |
| 적용 화면 | — | 청구 홈(진행바·기지급/잔여·한도 배지), 청구 안내 타임라인, 접수완료 지급 예정액, 내 청구 내역(1차/2차 금액·한도 사용), 홈 배너, 단계 토글, 보장 자격 판정 한도 |

기존 `claimPhaseInfo`·`eligibilityInfo` 모듈 상수는 `buildClaimPhaseInfo(account)`·
`buildEligibilityInfo(account)` 빌더 함수로 전환했다.

### 1-7. 돈워리 계산기

| 항목 | 사용 API | 내용 |
| --- | --- | --- |
| 재수 유형·지역 시세 정의 | `GET /api/cost-forms` | 유형 목록·월비용·설명(note)·지역 배율을 서버 카탈로그에서 로드 |
| 환산 결과 | `GET /api/cost-estimate` | 총비용·저축 개월·소득 개월·등록금 학기·노후 대비 %·보장 차감(최대 보장/최종 준비)을 서버 계산값으로 표시 |
| 환산 공식 표시 | — | 고정 분모(191·347·38,200·636만원) → 실제 선택값/통계 평균으로 표시 |
| 선택지 매핑 | — | UI 라벨 → 서버 파라미터 값 매핑 테이블(`savingValueByLabel` 등, 백엔드 `costs.py`의 `*_OPTIONS`와 동일) |

### 1-8. 마이페이지

| 항목 | 사용 API | 내용 |
| --- | --- | --- |
| 프로필·가입 정보 | `GET /api/student/{id}` | 이름·학년·티어·보장 상한·가입일 실데이터 |
| 모의고사 성적 히스토리 | `GET /api/student/{id}/scores` + `analysis` | 회차별 종합 백분위·직전 대비 등락(▲▼)·과목별 점수/등급을 DB 성적으로 구성. 최근순/과거순 정렬 유지 |
| 보험료 결제·납입 요약 | `GET /api/student/{id}` | 이번 달 보험료·결제 버튼 금액을 실제 월 보험료로 표시 |

### 검증 결과

- `npm run build` 통과 (TypeScript 타입체크 포함)
- 로컬 백엔드(포트 8000) 스모크 테스트 정상:
  - `/api/health` → LLM(anthropic)·DB 모두 정상
  - `/api/students` → 실제 학생 3명 이상 반환
  - `/api/student/stu_jimin` → 프로필 + enrollment + 성적 + pricing 반환
  - `/api/student/stu_jimin/premium-breakdown` → 월 4,396원 3분해 반환
  - `/api/cost-estimate` → 환산값 반환
  - `/api/chat` (개인화) → 김지민 보험료 3분해 표 + 약관 근거 답변

---

## 2. 나중에 할 일

### 2-1. 백엔드 API는 있는데 아직 화면 연동 안 된 것

| 기능 | 백엔드 | 할 일 |
| --- | --- | --- |
| 보험금 청구 실플로우 | `POST /api/claims`, `POST /api/claims/{id}/receipt`(영수증 업로드+OCR+카드 대조), `GET /api/claims/{id}/verification` | 현재 청구 플로우(촬영→스캔→검증→접수)는 전부 목업 연출. api-client에 `api.createClaim()`·`api.uploadReceipt()`·`api.claimVerification()`이 이미 있으므로 화면만 연결하면 됨 |
| 청구 지급 이력 | `GET /api/claims/{id}` | 기지급액이 현재 한도×26% 데모 파생. **`useClaimAccount()` 안의 `firstPaidManwon` 한 줄만** 실조회로 교체하면 전 화면 반영 (page.tsx에 TODO 주석 있음) |
| 결제 카드 등록/변경 | `POST /api/cards`, `PUT /api/cards/{id}`, `GET /api/cards/users/{id}/active` | 청구 1단계 카드 확인·카드 변경 화면이 로컬 상태만 사용 중 |
| 보장 자격 판정 | `GET /api/student/{id}/eligibility` | 판정 화면의 등급·σ 수치가 데모 값. 실제 수능 성적(`actual_percentile`) 입력이 생기면 `buildEligibilityInfo()` 한 곳만 교체 |
| 응시과목 선언 | `POST /api/student/{id}/declare-subjects` | 화면 자체가 없음 (고3 9월 갱신 시점 기능) |
| 갱신 이력 | `GET /api/student/{id}/renewals` | 보험료 재산정 D-day 카드가 목데이터. 갱신 스텝·캡 정보 연동 가능 |
| 해약환급금 | `GET /api/surrender-value` | 화면 없음 |
| 약관 원문 팝업 | `GET /api/policy/sections` | 채팅 근거를 현재 제목 텍스트로만 표시. 조항 전문 팝업/링크로 확장 가능 (`public/policy` 정적 HTML 링크는 존재) |
| 티어 비교·가입 조견표 | `GET /api/tiers`, `/api/quote`, `/api/regions`, `POST /api/enroll` | 가입(청약)은 웹(`web/`) 담당 범위 — 앱에서는 미사용 |

### 2-2. 백엔드에 DB/API 자체가 없는 것 (화면은 목업 유지 중)

| 기능 | 현재 상태 | 필요한 것 |
| --- | --- | --- |
| 보험료 결제·납입 내역 | 결제 시뮬레이터(성공/거절/한도 등 시나리오)와 납입 내역 목록이 전부 목업 | 결제(PG) 연동 + 납입 내역 테이블 (예: `jaesoo_payments`) |
| 결제수단 저장 | 카드 등록이 로컬 상태 | 위 `/api/cards` 연동 또는 결제수단 테이블 확장 |
| 알림 | 알림 페이지·읽음 상태·알림 설정 토글이 로컬 상태 | 알림 테이블 + 발송 로직 |
| 성적 등록 상태 히스토리 | OCR 확인필요/이의신청 이력이 목업 | 성적표 OCR 등록 파이프라인 + 상태 테이블 |
| 이의 신청 | 접수·진행 상황이 로컬 상태 | 이의신청 테이블 + 처리 플로우 |
| 인증(실로그인) | ID/PW 입력은 장식, 학생 선택 = 데모 로그인 | 실제 인증 도입 시 세션 로직 교체 (프로토타입 범위 밖으로 명시돼 있음) |
| 보험료 재산정일·납입 예정일 | `premiumPlan.nextDueDate` 등 목데이터 | 계약 일정 필드 (enrollment 확장 또는 renewals 활용) |

### 2-3. 배포 시 주의

- 앱 빌드 환경변수 **`NEXT_PUBLIC_API_URL`** 을 백엔드 주소로 반드시 설정할 것.
  미설정 시 `localhost:8000` 폴백이라 배포본에서 API 호출이 전부 실패하고 조용히
  데모 데이터로만 동작한다 (빌드 시점에 값이 박히므로 빌드 전에 설정).
- 청구 단계 토글(수능 전/후 등)은 시연용 미리보기다. 실서비스 전에는 실제 날짜/
  계약 상태 기반으로 단계를 결정하도록 교체 필요.
