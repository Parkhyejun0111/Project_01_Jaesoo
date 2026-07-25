# 임시 자산 — 원본 확보 후 교체 필요

원본 저장소(`~/Desktop/아카이브/`)가 iCloud Drive 안에 있고, 아래 파일들이 아직
내려받아지지 않은 상태(`SF_DATALESS`)였습니다. 그 파일을 읽으면 빌드가 CPU 0% 로
무한정 멈추기 때문에, 개발을 이어갈 수 있도록 **같은 경로·같은 용도의 임시 자산**을
만들어 두었습니다.

원본 폴더는 건드리지 않았습니다 — 임시 파일을 그쪽에 쓰면 iCloud 로 업로드되어
클라우드의 원본이 지워질 수 있어서입니다.

## 교체 방법

원본을 확보하면 아래 경로에 그대로 덮어쓰고, 옆의 `.placeholder` 표식 파일을 지우면 됩니다.

```bash
# 예시
cp ~/받은자산/jaesoo_logo.png app/public/jaesoo_logo.png
rm app/public/jaesoo_logo.png.placeholder
```

남아 있는 임시 파일은 언제든 이렇게 확인할 수 있습니다.

```bash
find . -name '*.placeholder' -not -path './node_modules/*'
```

## 임시로 대체한 이미지 (13개)

대각선 줄무늬가 들어간 단색 PNG 입니다 — 화면에서 바로 임시임을 알아볼 수 있습니다.

| 경로 | 원본 크기 | 용도 |
|---|---|---|
| `web/public/instructors/cha-mirae-angled-clean.png` | 475,991 B | 랜딩 강사 카드 (차미래 · 국어) |
| `web/public/instructors/yunseo-math-card-polished.png` | 351,266 B | 랜딩 강사 카드 (이윤서 · 수학) |
| `web/public/instructors/choi-jihyun-fixed.png` | 1,647,998 B | 랜딩 강사 카드 (최지현 · 사회문화) |
| `web/public/instructors/han-heeji-history-card.png` | 1,177,967 B | 랜딩 강사 카드 (한희지 · 한국사) |
| `app/public/jaesoo_logo.png` | 1,242,908 B | 앱 로고 |
| `app/public/logo-final-dark.png` | 1,242,908 B | 앱 로고 (다크) |
| `app/public/logo-final-white.png` | 1,345,961 B | 앱 로고 (화이트) |
| `app/public/logo_final_white.png` | 1,345,961 B | 앱 로고 (화이트, 중복 파일명) |
| `app/public/donworry_icon4.png` | 1,468,123 B | 돈워리 계산기 아이콘 |
| `app/public/grade-analysis.png` | 1,457,964 B | 성적분석 일러스트 |
| `app/public/paw-loader.png` | 177,180 B | 챗봇 로딩 발자국 |
| `app/public/paw-loader-source.png` | 944,281 B | 챗봇 로딩 발자국 (원본) |
| `app/public/paw-steps.png` | 949,422 B | 발자국 애니메이션 |

## 빠진 폰트 (2개) — 임시 자산을 만들지 않음

| 경로 | 원본 크기 |
|---|---|
| `web/public/fonts/KoddiUDOnGothic-ExtraBold.ttf` | 2,477,716 B |
| `web/public/fonts/KoddiUDOnGothic-Regular.ttf` | 5,246,048 B |

폰트는 가짜 파일을 만들면 브라우저가 오류를 내므로 **아예 넣지 않았습니다.**
`web/src/index.css` 의 `@font-face` 는 `"Noto Sans KR", -apple-system, …` 폴백을
가지고 있어 화면은 정상적으로 뜨고, 서체만 시스템 기본으로 보입니다.
원본 TTF 를 넣으면 별도 코드 수정 없이 즉시 적용됩니다.

(`KoddiUDOnGothic-Bold.ttf` 는 이미 정상이라 그대로 들어 있습니다.)

## 재생성

임시 자산을 다시 만들어야 하면:

```bash
node scripts/make-placeholder-assets.mjs
```

이 스크립트는 **`.placeholder` 표식이 없는 진짜 자산은 건드리지 않습니다.**
