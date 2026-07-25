# 자산 상태 — 전부 원본으로 교체 완료 ✅

원본 저장소가 iCloud Drive 안에 있어 일부 이미지·폰트가 내려받아지지 않은
상태(`SF_DATALESS`)였고, 그 파일을 읽으면 빌드가 무한정 멈추기 때문에 한동안
임시 자산으로 대체해 두었습니다. **지금은 모두 원본으로 교체됐습니다.**

## 웹 (`web/public/`)

| 항목 | 출처 |
|---|---|
| `fonts/KoddiUDOnGothic-{Regular,Bold,ExtraBold}.ttf` | `web_more/frontend/public` |
| `instructors/` 6장 (차미래·이윤서·박혜준·한희지·최지현·노재희) | 〃 |
| `jaesoo_character.png` | 〃 |

## 앱 (`app/public/`)

| 항목 | 출처 |
|---|---|
| `logo-final-dark.png` · `jaesoo_logo.png` | `add_pngs` |
| `logo-final-white.png` · `logo_final_white.png` | 〃 |
| `donworry_icon4.png` · `grade-analysis.png` | 〃 |
| `paw-loader.png` · `paw-loader-source.png` · `paw-steps.png` | 〃 |
| `fonts/PretendardVariable.woff2` | 〃 (신규 — 아래 참조) |

`jaesoo_character.png` · `og.png` · `no_icon_v2.png` · `favicon.svg` 는 원래부터 원본이었습니다.

> `jaesoo_logo.png` 는 `logo-final-dark.png` 와, `logo_final_white.png` 는
> `logo-final-white.png` 와 내용이 같습니다(파일명만 다른 중복). 원본 크기가
> 정확히 일치하는 것으로 확인했습니다.

## Pretendard 폰트를 새로 넣은 이유

`app/globals.css` 의 `--font-ui` 가 Pretendard 를 첫 순위로 지정하는데
`@font-face` 가 없었습니다. 그러면 **보는 사람 PC 에 Pretendard 가 설치돼
있을 때만** 적용되고, 없으면 조용히 다음 폴백(SUIT → Apple SD Gothic Neo →
Noto Sans KR)으로 떨어져 화면이 사람마다 다르게 보입니다.

가변폰트 woff2(2MB) 하나를 자체 호스팅해 전 굵기를 커버하도록 했습니다.
(`.ttf` 6.7MB 대신 `.woff2` 를 쓴 이유는 용량입니다 — 현대 브라우저는 모두 지원합니다.)

## 확인 방법

임시 자산이 남아 있는지는 이 명령으로 확인합니다. **지금은 0개입니다.**

```bash
find . -name '*.placeholder' -not -path './node_modules/*'
```

임시 자산을 다시 만들어야 할 일이 생기면 `node scripts/make-placeholder-assets.mjs`
를 쓸 수 있습니다. 이 스크립트는 `.placeholder` 표식이 없는 진짜 자산은 건드리지
않으므로, 지금 상태에서 실행해도 아무것도 덮어쓰지 않습니다.
