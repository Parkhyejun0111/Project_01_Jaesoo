---
version: "1.0"
name: "재수없수 Care Design System"
description: "보험보다 보호자에 가까운, 따뜻하고 명료한 모바일 안심 UX"
colors:
  brand-primary: "#0CB474"
  brand-strong: "#087D53"
  brand-deep: "#075B3F"
  brand-soft: "#C4F9FF"
  brand-highlight: "#DFFF87"
  canvas: "#FFFBF2"
  canvas-gray: "#F3F3F3"
  canvas-gray-white: "#F3F3F3 canvas with white grades and converter tabs"
  canvas-white: "#F3F3F3 canvas with white home, grades, and converter tabs"
  canvas-cream-white: "#FFFBF2 canvas with white grades, converter, and mypage tabs"
  surface: "#FFFFFF"
  text-primary: "#12372B"
  text-secondary: "#62746E"
  border: "#DCE7E2"
  insight-positive-bg: "#EEFAF5"
  insight-danger-bg: "#FFF3F1"
  subject-korean: "#F5604E"
  subject-math: "#13BCAD"
  subject-english: "#3B5998"
  subject-inquiry: "#FFC83B"
typography:
  display: "Pretendard 900 32px/1.25"
  heading-lg: "Pretendard 850 25px/1.30"
  heading-md: "Pretendard 850 20px/1.35"
  title: "Pretendard 800 16px/1.45"
  body: "Pretendard 500 13px/1.60"
  caption: "Pretendard 600 11px/1.55"
  label: "Pretendard 800 10px/1.40"
rounded:
  sm: "8px"
  md: "12px"
  control: "16px"
  section: "18px"
  card: "24px"
  pill: "9999px"
spacing:
  unit: "4px"
  screen-gutter: "20px"
  content-inset: "5px"
  section-gap: "32px"
components:
  button-primary: "54px high, brand-primary fill, white 850 text, control radius"
  card: "surface fill, 1px border when needed, card radius, no shadow"
  insight: "semantic tinted fill, section radius, no shadow"
  input: "54px minimum height, surface fill, 1px border, control radius"
  bottom-nav: "78px high, white surface, 1px top border, no shadow"
---

# Overview

재수없수는 보험 회사처럼 차갑고 계산적으로 보이지 않아야 한다. 학생과 보호자 곁에서 성적, 보험료, 보장 과정을 차분하게 설명하는 **보호자형 서비스**다. 시각 언어는 따뜻하고 둥글며 친근하지만, 중요한 숫자와 상태는 단정하고 신뢰감 있게 전달한다.

이 문서는 제품 전반의 시각적 단일 기준이다. 현재 구현 화면을 시각적 출발점으로 삼고, PRD와 목업 데이터는 기능·상태·문구의 근거로만 사용한다. 새로운 화면은 이 문서의 토큰과 패턴을 먼저 재사용한다.

## Core principles

1. **안심이 먼저다.** 위험을 과장하지 않고, 다음 행동을 쉬운 말로 안내한다.
2. **하나의 화면에는 하나의 주행동만 둔다.** 메인 그린은 가장 중요한 행동과 활성 상태에 집중한다.
3. **평면적으로 구분한다.** 그림자 대신 배경 톤, 1px 테두리, 구분선, 여백으로 깊이를 만든다.
4. **숫자는 즉시 읽힌다.** 보험료, D-day, 백분위, 등록 상태는 주변 문구보다 크고 진하게 표현한다.
5. **친근함과 신뢰를 함께 유지한다.** 둥근 형태와 마스코트는 안심을 만들고, 정돈된 정렬과 일관된 규칙은 신뢰를 만든다.

# Colors

## Brand palette

- `brand-primary #0CB474`: 주행동, 활성 탭, 핵심 데이터 포인트.
- `brand-strong #087D53`: 호버, 강조 제목, 짙은 브랜드 면.
- `brand-deep #075B3F`: 고대비 텍스트, 포커스 외곽선.
- `brand-soft #C4F9FF`: 보조 정보, 안정성 지표, 차분한 배경.
- `brand-highlight #DFFF87`: 작은 강조, 마스코트 포인트. 넓은 면적에는 사용하지 않는다.
- `canvas #F3F3F3`: 앱 기본 배경.
- `surface #FFFFFF`: 입력, 카드, 내비게이션처럼 분리된 표면.

## Semantic palette

- 긍정·설명: `#EEFAF5` 배경과 `#086B49` 텍스트.
- 주의·보장 기준: `#FFF3F1` 배경과 `#B2382B` 텍스트.
- 과목 색상은 전 화면에서 고정한다: 국어 `#F5604E`, 수학 `#13BCAD`, 영어 `#3B5998`, 탐구 `#FFC83B`.
- 회색은 따뜻한 녹색 기가 있는 `text-secondary`와 `border`를 쓴다. 차갑고 푸른 금융 앱 회색을 새로 만들지 않는다.

화이트 텍스트를 그린 배경에 쓸 때는 `brand-primary`보다 어두운 그라디언트 또는 `brand-strong`을 포함해 WCAG AA 대비를 확보한다. 색상만으로 상태를 전달하지 않고 텍스트, 아이콘, 선 스타일을 함께 사용한다.

# Typography

기본 서체는 Pretendard다. 설치되지 않은 환경에서는 SUIT, Apple SD Gothic Neo, Noto Sans KR, Arial 순서로 대체한다.

- Display: 32px/1.25, 900. 히어로 핵심 메시지와 큰 숫자.
- Heading large: 25px/1.30, 850. 화면 단위 제목.
- Heading medium: 20px/1.35, 850. 주요 섹션 제목.
- Title: 16px/1.45, 800. 카드·항목 제목.
- Body: 13px/1.60, 500. 설명과 본문.
- Caption: 11px/1.55, 600. 보조 정보와 그래프 주석.
- Label: 10px/1.40, 800. 칩, 배지, 탭 라벨.

한글 제목은 자간을 과도하게 좁히지 않는다. 수치에는 tabular numbers를 사용하고, 단위는 수치보다 한 단계 작고 옅게 표현한다.

# Layout

- 모바일 우선 기준 폭은 430px이며, 넓은 화면에서는 앱 셸을 중앙 정렬한다.
- 기본 화면 좌우 여백은 20px이다. 성적 리포트처럼 그래프 면적이 중요한 연속 콘텐츠는 내부에 5px까지 추가 확장할 수 있다.
- 4px 배수 간격을 사용한다. 기본 간격은 8, 12, 16, 20, 24, 32, 40, 48, 64px이다.
- 섹션 사이 기본 간격은 32px, 제목과 콘텐츠 사이는 12–16px이다.
- 하단 탭바가 있는 화면은 최소 96px의 하단 안전 여백을 둔다.
- 보고서형 콘텐츠는 큰 카드 여러 개로 쪼개지 않고 구분선과 여백으로 흐름을 만든다. 독립 행동, 독립 상태, 의미가 있는 인사이트만 카드로 묶는다.

# Elevation & Depth

제품 UI에는 장식용 그림자를 사용하지 않는다. 카드, 버튼, 탭, 모달, 선택 상태도 기본적으로 `box-shadow: none`이다.

깊이와 계층은 다음 순서로 표현한다.

1. 배경 톤 차이
2. 1px 테두리 또는 구분선
3. 여백과 겹침
4. 타이포그래피의 크기·굵기

키보드 포커스 링은 접근성 표시이므로 그림자 금지 규칙의 예외다. 흰색 간격과 `brand-deep` 외곽선을 사용해 배경과 분리한다.

# Shapes

- 작은 상태 요소: 8px
- 일반 작은 컨테이너: 12px
- 입력·버튼: 16px
- 인사이트·섹션: 18px
- 독립 카드: 24px
- 칩·세그먼트·pill 버튼: 9999px

지나치게 각진 모서리, 날카로운 꼬리, 복잡한 유리 효과는 사용하지 않는다. 같은 계층의 컴포넌트는 같은 반경을 사용한다.

# Components

## App shell and headers

앱 셸은 최대 430px다. 홈 히어로는 동일한 145도 그린 그라디언트를 사용하고, 장식은 반투명 클로버처럼 낮은 대비로 제한한다. 서브 화면의 뒤로가기는 좌측 상단에 `‹ 이전 화면명` 텍스트 패턴으로 통일한다. 상단 로고와 알림 버튼은 같은 기준선에 맞춘다.

## Buttons

- Primary: 높이 54px 이상, `brand-primary` 배경, 흰색 굵은 텍스트, 16px 반경.
- Secondary: 흰색 또는 투명 배경, 1px 브랜드 테두리, 브랜드 텍스트.
- Hero pill: 동일한 높이·패딩·아이콘 크기를 유지한다. 얇은 민트 테두리와 투명 그린 배경을 쓴다.
- Hover 가능한 환경에서는 1–2px 위로 이동하고 배경 톤만 조금 밝힌다. 그림자는 추가하지 않는다.
- 비활성 상태는 채도와 대비를 낮추되 라벨을 읽을 수 있어야 한다.

## Inputs

최소 높이는 54px, 16px 반경, 흰색 표면과 1px 테두리를 사용한다. 입력 자체에 네모난 기본 포커스 박스를 만들지 말고 컨테이너의 `focus-within` 테두리 또는 둥근 포커스 링을 사용한다. 전송 아이콘은 오른쪽을 향하고, 텍스트 입력과 버튼은 수직 중앙 정렬한다.

## Cards, sections, and insights

일반 카드는 흰색, 24px 반경, 필요할 때만 1px 테두리를 사용한다. 그림자는 없다. 연속적인 분석 화면은 카드 대신 구분선을 우선한다. 초록 인사이트와 빨간 보장 안내처럼 의미가 독립적인 블록만 채색된 카드로 유지한다.

## Segments, chips, and badges

세그먼트는 한 줄 pill 트랙 안에서 활성 항목만 그린으로 채운다. 필터 칩은 선택 시 그린 테두리와 그린 글자 또는 채움으로 표시한다. 색상 점만으로 과목을 구분하지 않는다.

## Choice tiles

두 개 이상의 생활 조건이나 비용 기준을 비교 선택할 때는 같은 폭의 그리드 타일을 사용한다. 기본 타일은 흰색 표면과 1px 중립 테두리이며, 선택 타일은 연한 그린 배경·메인 그린 테두리를 함께 표시한다. 텍스트는 중앙 정렬하고 별도의 체크 표시는 사용하지 않는다. `선택안함`처럼 선택을 해제하는 타일은 기본 상태에서도 아주 연한 그린 테두리로 구분한다. 타일 높이, 내부 정렬, 제목의 기준선을 같은 그룹 안에서 통일한다.

## Navigation

하단 탭바는 높이 78px, 흰색 배경, 상단 1px 테두리다. 활성 항목은 아이콘과 라벨을 그린으로 바꾸고, 그림자나 떠오르는 원형 배경은 사용하지 않는다. 라벨은 `홈`, `성적분석`, `돈워리`, `마이`로 간결하게 유지한다.

## Icons

Lucide 또는 Line Awesome 계열의 단순한 선형 아이콘을 사용한다. 기본 크기는 20px, 작은 라벨은 16–18px, 주요 행동은 24px다. 선 굵기는 한 화면에서 1.75–2px로 통일한다. 같은 의미에 서로 다른 아이콘을 혼용하지 않는다.

## Charts and progress

- 축과 그리드는 콘텐츠보다 옅은 `border` 계열을 사용하고, 필요 없는 세로선은 제거한다.
- 전체 과목 선택 시 네 개의 선만 표시하고 영역 그라디언트는 숨긴다.
- 한 과목 선택 시 해당 선 아래에만 낮은 불투명도의 그라디언트를 표시한다.
- 포인트 마커는 5–7px로 작게 유지한다. 마지막 핵심 수치만 더 명확히 표시할 수 있다.
- 보장 기준선은 빨간 점선과 직접 라벨로 표시한다.
- 진행 바는 과목 색상을 유지하되 장식적인 광택이나 그림자를 사용하지 않는다.
- 원형 안정성 지표는 작고 단순하게 유지하며 중앙에는 숫자만 크게 표시한다.

## Loading and empty states

계산, 로그인, 청구 제출 등 기다림이 있는 화면에는 같은 마스코트와 짧은 현재 상태 문구를 사용한다. 사용자가 할 수 있는 다음 행동이 없다면 가짜 버튼을 만들지 않는다.

# Motion

기본 전환은 160–240ms, `cubic-bezier(0.2, 0, 0, 1)`이다. hover 이동은 최대 2px, 눌림은 원위치 복귀 정도로 제한한다. 로딩 회전 외에는 지속적인 반복 애니메이션을 사용하지 않는다. `prefers-reduced-motion`에서 이동과 반복을 제거한다.

# Accessibility

- 모든 클릭 대상은 실제 `button` 또는 `a`를 사용한다.
- 터치 대상은 최소 44×44px다.
- 모든 아이콘 버튼에 접근 가능한 이름을 제공한다.
- `focus-visible` 상태를 제거하지 않는다. 시각적으로 맞지 않으면 둥근 컨테이너 포커스로 대체한다.
- 차트는 제목, 요약 문장, 범례 또는 표 형태의 대체 정보를 제공한다.
- 핵심 상태는 색상 외에 숫자, 라벨, 선 모양을 함께 쓴다.

# Content

- 보호자에게 말하듯 짧고 구체적인 문장을 쓴다.
- 보험 용어는 바로 뒤에 쉬운 설명을 붙인다.
- 불안을 자극하는 확정 표현보다 현재 상태, 판단 기준, 다음 행동의 순서로 설명한다.
- 보장과 청구는 조건부임을 분명히 한다. 실제 수능 종료 시각 이후 등 시스템 조건이 충족되기 전에는 청구 행동을 노출하지 않는다.
- 전문 통계 기호나 계산식보다 “전국 상위 37%”, “평소보다 15점 낮음”처럼 해석 가능한 말을 우선한다.

# Do’s and Don’ts

## Do

- 브랜드 그린은 가장 중요한 행동과 활성 상태에 집중한다.
- 페이지 안에서 같은 계층의 반경과 여백을 반복한다.
- 정보가 이어질 때는 카드보다 구분선을 사용한다.
- 디자인 토큰을 먼저 사용하고, 새 값이 필요하면 이 문서와 CSS 토큰을 함께 갱신한다.
- 새 공통 패턴은 `/design-system` 카탈로그에 실제 상태와 함께 추가한다.

## Don’t

- 카드나 버튼에 장식용 그림자를 넣지 않는다.
- 차가운 네이비·블루그레이 중심의 전형적인 금융 앱 스타일을 만들지 않는다.
- 모든 정보를 카드로 감싸거나 모든 요소를 그린으로 강조하지 않는다.
- 화면마다 다른 그라디언트 각도, 탭바 높이, 카드 반경을 만들지 않는다.
- 아이콘, 이모지, 선형 아이콘을 무분별하게 섞지 않는다.

# Governance

`DESIGN.md`가 시각 규칙의 원본이고, `app/globals.css`의 `:root`가 실행 가능한 토큰 매핑이며, `/design-system`이 시각 검수 표면이다. 세 곳의 값이 다르면 `DESIGN.md`를 기준으로 맞춘다.

새로운 공통 UI 패턴을 도입하는 변경은 다음을 한 번에 포함해야 한다.

1. 이 문서의 규칙 또는 토큰 갱신
2. `app/globals.css` 토큰 갱신
3. `/design-system` 카탈로그 예시 갱신
4. 실제 화면 구현과 모바일 검증
