# 임시 자산 — 원본 확보 후 교체 필요

원본 저장소(`~/Desktop/아카이브/`)가 iCloud Drive 안에 있고, 일부 파일이 아직
내려받아지지 않은 상태(`SF_DATALESS`)였습니다. 그 파일을 읽으면 빌드가 CPU 0% 로
무한정 멈추기 때문에, 개발을 이어갈 수 있도록 임시 자산으로 대체해 두었습니다.

## ✅ 웹 — 전부 원본으로 교체 완료

`web_more/frontend/public` 에서 원본을 확보해 적용했습니다. 임시 자산이 남아 있지 않습니다.

| 항목 | 상태 |
|---|---|
| `web/public/fonts/KoddiUDOnGothic-{Regular,Bold,ExtraBold}.ttf` | ✅ 원본 |
| `web/public/instructors/` 6장 (차미래·이윤서·박혜준·한희지·최지현·노재희) | ✅ 원본 |
| `web/public/jaesoo_character.png` | ✅ 원본 |

## ⚠️ 앱 — 아직 임시 자산 (9개)

`web_more` 는 웹 전용 폴더라 앱 이미지가 없었습니다. 원본이 있는 폴더를 찾으면
아래 경로에 덮어쓰고 옆의 `.placeholder` 표식을 지우면 됩니다.

| 경로 | 원본 크기 | 용도 |
|---|---|---|
| `app/public/jaesoo_logo.png` | 1,242,908 B | 앱 로고 |
| `app/public/logo-final-dark.png` | 1,242,908 B | 앱 로고 (다크) |
| `app/public/logo-final-white.png` | 1,345,961 B | 앱 로고 (화이트) |
| `app/public/logo_final_white.png` | 1,345,961 B | 앱 로고 (화이트, 중복 파일명) |
| `app/public/donworry_icon4.png` | 1,468,123 B | 돈워리 계산기 아이콘 |
| `app/public/grade-analysis.png` | 1,457,964 B | 성적분석 일러스트 |
| `app/public/paw-loader.png` | 177,180 B | 챗봇 로딩 발자국 |
| `app/public/paw-loader-source.png` | 944,281 B | 챗봇 로딩 발자국 (원본) |
| `app/public/paw-steps.png` | 949,422 B | 발자국 애니메이션 |

`app/public/jaesoo_character.png` 는 원본입니다.

## 찾아볼 만한 곳

`~/Desktop/아카이브/` 루트에 로고 후보가 있습니다. 지금은 iCloud 미다운로드
상태(`SF_DATALESS`)라 쓸 수 없지만, 내려받아지면 교체 후보입니다.

| 파일 | 크기 | 비고 |
|---|---|---|
| `app_logo.png` | 1,242,908 B | `jaesoo_logo.png`·`logo-final-dark.png` 와 **크기 일치** |
| `nofaesoo_3D.png` | 2,213,964 B | 마스코트 3D |
| `nojaesoo.png` | 886,945 B | 마스코트 |

Finder 에서 해당 파일을 우클릭 → "지금 다운로드" 한 뒤 아래 방법으로 교체하세요.

## 교체 방법

```bash
cp ~/받은자산/jaesoo_logo.png app/public/jaesoo_logo.png
rm app/public/jaesoo_logo.png.placeholder
```

남은 임시 파일 확인:

```bash
find . -name '*.placeholder' -not -path './node_modules/*'
```

임시 자산을 다시 만들어야 하면 `node scripts/make-placeholder-assets.mjs` 를 돌립니다.
이 스크립트는 **`.placeholder` 표식이 없는 진짜 자산은 건드리지 않습니다.**
