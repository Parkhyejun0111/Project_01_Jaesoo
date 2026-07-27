# 지역계수 파이프라인

```
최종 지역계수 = 시도계수(거시) × 구보정계수(미시)
```

| | 시도계수 | 구보정계수 |
|---|---|---|
| 출처 | 통계청 KOSIS 초중고 사교육비조사 (`DT_1PE105`) | 서울 열린데이터광장 학원 정보 (`neisAcademyInfo`) |
| 기준 | 시도 학생 1인당 월평균 사교육비 ÷ **전국 평균** | 구별 입시·보습 학원 평균 수강료 ÷ **서울 전체 평균** |
| 적용 범위 | 전국 17개 시도 | 서울 25개 자치구 (**서울 밖은 1.0**) |
| 갱신 | 연 1회 공표 → 월 1회 배치로 확인 | 월 1회 배치 |

두 배율을 곱하는 것은 이중계상이 아니다. 시도계수는 *전국 대비 그 시도*의 수준을,
구보정계수는 *서울 평균 대비 그 구*의 편차를 잡는다. 구보정계수는 서울 안에서
평균이 1 근처이므로 서울의 수준 자체를 두 번 세지 않는다.

학원 수/밀도는 이번 범위에서 제외했다. `get_region_coefficient(..., density_weight=)`
인자가 향후 확장 자리다.

## 구성

| 파일 | 역할 |
|---|---|
| `config.py` | 환경변수·경로. 인증키는 전부 `.env` 에서만 읽는다 |
| `http.py` | httpx 기반 GET + 재시도 (표준 urllib 은 TLS 프록시 환경에서 실패한다) |
| `kosis.py` | 메타 조회 → 파라미터 코드 확인 → 데이터 조회 → 시도계수 |
| `seoul.py` | 페이지네이션 수집 → 계열 필터 → 구 추출 → 수강료 파싱 → 구보정계수 |
| `coefficients.py` | **런타임 조회부.** API 를 부르지 않고 `config/*.json` 만 읽는다 |
| `collect.py` | 월 1회 배치 엔트리포인트 |

## 실행

```bash
python -m regional.collect              # 두 소스 모두
python -m regional.collect --kosis      # 시도계수만
python -m regional.collect --dry-run    # 파일을 쓰지 않고 결과만 출력
```

cron 등록은 `scripts/collect-regional.sh` 주석 참고 (매월 1일 04:10 권장).

## 산출물

```
config/sido_coefficients.json          시도계수 + 원자료 + 출처 메타
config/seoul_gu_coefficients.json      구보정계수 + 표본 수 + 출처 메타
config/region_coefficients_final.json  결합 캐시 (앱이 읽는 정본)
config/collect_log.jsonl               배치 로그 — 수집 건수·계수 변화량
```

`api/config/` 에 같은 내용이 함께 쓰인다. Vercel 은 `api/` 를 함수 루트로 잡으므로
저장소 루트의 `config/` 가 배포 번들에 들어가지 않기 때문이다.

## 폴백

- 한 소스가 실패하면 그 소스의 **직전 캐시를 그대로 유지**한다. 비우거나 1.0 으로
  덮어쓰지 않는다.
- 계수 파일이 아예 없거나 깨졌으면 모든 조회가 `1.0`(전국 평균)으로 떨어지고,
  화면은 "지역별 시세를 불러오지 못해 전국 평균 기준으로 계산했어요" 를 표시한다.
- 불명·신규 지역도 `1.0` 이다.

## 실측 주의사항

두 API 모두 흔히 인용되는 문서와 실제 응답이 다르다. 아래는 2026-07-27 실측이다.

**KOSIS** — 파라미터 방식 데이터 조회는 `statisticsData.do?method=getList` 가 아니라
`/openapi/Param/statisticsParameterData.do` 가 받는다. 전자는 이 표에 대해
`err 20`(필수요청변수 누락)을 돌려준다. 메타 응답은 키를 따옴표로 감싸지 않은
비표준 JSON 이므로 `json.loads` 로 바로 읽히지 않는다 (`kosis._loads` 가 처리).
`getMeta&type=OBJ` 는 이 표에서 `err 30` 이고, 분류 코드는 `type=ITM` 응답에
함께 들어 있다.

**서울 열린데이터광장** — 컬럼명이 과거 표기와 전부 다르다.

| 과거 표기 | 실제 컬럼 |
|---|---|
| `ACA_NM` | `PEI_NM` |
| `FA_RDNMA` | `ROAD_NM_ADDR` |
| `REALM_SC_NM` | `FLD_NM` (`"입시.검정 및 보습"`) |
| `PSNBY_THCC_CNTNT` | `INDV_ATNLC_AMT_CN` |

그리고 `INDV_ATNLC_AMT_CN` 은 숫자 하나가 아니라 과정별 목록 문자열이다
(`"초등수학:140000, 고등수학:450000"`). 학원 단위로 먼저 평균한 뒤 구 단위로
다시 평균한다 — 행 단위로 바로 평균하면 과정 수가 많은 학원이 과대대표된다.
수강료 공개율은 입시·보습 계열의 약 25% 이므로 `sample_size` 를 함께 남긴다.
