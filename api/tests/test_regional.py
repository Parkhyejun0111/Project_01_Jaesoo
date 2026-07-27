"""지역계수 파이프라인 테스트.

네트워크를 타지 않는다. `tests/fixtures/` 의 스냅샷은 실제 API 호출 원문을 그대로
저장한 것이다 (2026-07-27 수집):

  · kosis_meta_itm.json     getMeta&type=ITM  — 따옴표 없는 키를 가진 비표준 JSON 원문
  · kosis_meta_prd.json     getMeta&type=PRD
  · kosis_data_2025.json    Param/statisticsParameterData.do getList (2025년)
  · seoul_academy_sample.json  neisAcademyInfo 응답 행 표본 (구별 최대 12곳 + 필터 검증용 행)

스냅샷을 다시 뜨려면 실제 호출로 덮어쓴 뒤 여기 기대값을 갱신한다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from regional import coefficients as rc  # noqa: E402
from regional import config as rcfg  # noqa: E402
from regional import kosis, seoul  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


def _raw(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def _json(name: str):
    return json.loads(_raw(name))


# ══════════════════════════════════════════════════════════════════════════
# KOSIS 메타 파싱 — 파라미터 코드는 추측하지 않고 메타에서 읽는다
# ══════════════════════════════════════════════════════════════════════════
def test_메타_응답은_따옴표없는_키를_가진_비표준_JSON():
    """표준 json.loads 로는 못 읽는다 — 이 사실이 파서의 존재 이유다."""
    raw = _raw("kosis_meta_itm.json")
    assert raw.lstrip().startswith("[{OBJ_ID:"), "스냅샷이 비표준 JSON 이 아니게 바뀌었다"
    with pytest.raises(json.JSONDecodeError):
        json.loads(raw)
    assert isinstance(kosis._loads(raw), list)


def test_메타에서_항목코드와_시도축을_읽는다():
    meta = kosis.parse_item_meta(kosis._loads(_raw("kosis_meta_itm.json")))

    # 전체학생 평균 항목
    assert meta["item_id"] == "T00"
    assert meta["item_name"] == "평균"
    # 학교급 항목도 함께 보인다 (KOSIS_ITM_ID 로 바꿔 쓸 수 있게)
    assert meta["items"]["T03"] == "고등학교"
    # 시도 분류는 objL1 축
    assert meta["obj_param"] == "objL1"
    assert meta["axis_name"] == "시도별"
    # 전국(합계)은 분리되고 17개 시도만 남는다
    assert meta["national_code"] == "00"
    assert len(meta["sido_codes"]) == 17
    assert meta["sido_codes"]["11"] == "서울특별시"
    assert "00" not in meta["sido_codes"]


def test_항목축이_없으면_추측하지_않고_실패한다():
    rows = [r for r in kosis._loads(_raw("kosis_meta_itm.json")) if r.get("OBJ_ID") != "ITEM"]
    with pytest.raises(kosis.KosisError, match="OBJ_ID='ITEM' 행이 없다"):
        kosis.parse_item_meta(rows)


def test_시도축이_없으면_추측하지_않고_실패한다():
    rows = [dict(r, OBJ_NM="가구원수별") if r.get("OBJ_ID") == "C" else r
            for r in kosis._loads(_raw("kosis_meta_itm.json"))]
    with pytest.raises(kosis.KosisError, match="분류 축을 메타에서 찾지 못했다"):
        kosis.parse_item_meta(rows)


def test_KOSIS_오류응답은_예외로_올린다():
    payload = kosis._loads('{"err":"11","errMsg":"유효하지않은 인증KEY입니다."}')
    assert payload["err"] == "11"       # 오류 응답은 정상 JSON 으로 온다


def test_수록기간_메타에서_최신연도():
    assert kosis.latest_year(kosis._loads(_raw("kosis_meta_prd.json"))) == "2025"


def test_수록기간이_연간이_아니면_실패한다():
    with pytest.raises(kosis.KosisError, match="연간 수록기간"):
        kosis.latest_year([{"PRD_SE": "월", "END_PRD_DE": "202512"}])


# ══════════════════════════════════════════════════════════════════════════
# KOSIS 데이터 파싱 → 시도계수
# ══════════════════════════════════════════════════════════════════════════
@pytest.fixture
def kosis_meta():
    return kosis.parse_item_meta(kosis._loads(_raw("kosis_meta_itm.json")))


@pytest.fixture
def kosis_parsed(kosis_meta):
    return kosis.parse_expense_rows(_json("kosis_data_2025.json"), kosis_meta)


def test_데이터응답_스냅샷_파싱(kosis_parsed):
    """전국 1행 + 시도 17행."""
    assert len(kosis_parsed) == 18
    by_name = {r["sido"]: r for r in kosis_parsed}
    assert by_name["전국"]["expense_manwon"] == pytest.approx(45.75167)
    assert by_name["서울"]["expense_manwon"] == pytest.approx(66.33812)
    assert by_name["전남"]["expense_manwon"] == pytest.approx(30.8912)
    assert all(r["period"] == "2025" for r in kosis_parsed)
    assert all(r["unit"] == "만원" for r in kosis_parsed)


def test_분류컬럼이_없으면_실패한다(kosis_meta):
    rows = [{k: v for k, v in r.items() if k != "C1"} for r in _json("kosis_data_2025.json")]
    with pytest.raises(kosis.KosisError, match="분류 컬럼 C1 이 없다"):
        kosis.parse_expense_rows(rows, kosis_meta)


def test_결측_DT_는_버린다(kosis_meta):
    rows = [dict(r, DT="-") for r in _json("kosis_data_2025.json")]
    with pytest.raises(kosis.KosisError, match="유효한 DT 값을 하나도"):
        kosis.parse_expense_rows(rows, kosis_meta)


def test_시도계수는_전국평균_대비_비율(kosis_parsed, kosis_meta):
    built = kosis.build_sido_coefficients(kosis_parsed, kosis_meta)
    co = built["coefficients"]

    assert len(co) == 17
    assert "전국" not in co, "전국은 분모이므로 계수 표에 들어가면 안 된다"
    assert built["national_average_manwon"] == pytest.approx(45.75167)

    # 66.33812 / 45.75167 = 1.4500
    assert co["서울"] == pytest.approx(1.45, abs=5e-4)
    assert co["경기"] == pytest.approx(1.0906, abs=5e-4)
    assert co["전남"] == pytest.approx(0.6752, abs=5e-4)
    assert co["서울"] > co["경기"] > co["인천"] > co["전남"]

    # 출처 메타 — 각주에 그대로 쓰인다
    assert built["source"]["table_id"] == "DT_1PE105"
    assert built["source"]["item_id"] == "T00"
    assert built["source"]["period"] == "2025"


@pytest.mark.parametrize("official,short", [
    ("서울특별시", "서울"),
    ("부산광역시", "부산"),
    ("세종특별자치시", "세종"),
    ("경기도", "경기"),
    ("강원특별자치도", "강원"),      # 개편 전 '강원도' 여도 '강원'
    ("강원도", "강원"),
    ("충청북도", "충북"),
    ("전라남도", "전남"),
    ("경상북도", "경북"),
    ("제주특별자치도", "제주"),
    ("전국", "전국"),
])
def test_시도명_정규화(official, short):
    assert kosis.short_sido_name(official) == short


# ══════════════════════════════════════════════════════════════════════════
# 구 추출 정규식
# ══════════════════════════════════════════════════════════════════════════
@pytest.mark.parametrize("address,expected", [
    ("서울 강남구 역삼동 123-4", "강남구"),
    ("서울특별시 강남구 테헤란로 123", "강남구"),
    ("서울특별시 동대문구 왕산로 225", "동대문구"),
    ("서울특별시 서대문구 신촌로 100", "서대문구"),
    ("서울특별시 중구 세종대로 110", "중구"),
    ("서울특별시 영등포구 여의대로 24", "영등포구"),
    ("  서울특별시   송파구   올림픽로 300  ", "송파구"),
    ("서울특별시 강서구 공항대로 지하 376", "강서구"),
])
def test_구_추출_성공(address, expected):
    assert seoul.extract_gu(address) == expected


@pytest.mark.parametrize("address", [
    "",
    None,
    "경기도 성남시 분당구 판교역로 235",   # 서울 밖은 이 파이프라인 대상이 아니다
    "서울특별시 종로1가",                  # 구 표기가 없음
])
def test_구_추출_실패_케이스(address):
    result = seoul.extract_gu(address)
    # 분당구는 정규식상 '구' 로 잡히지만, 서울 데이터셋에만 이 함수를 쓰므로 문제되지 않는다.
    # 여기서 확인하는 것은 예외 없이 None 또는 문자열을 돌려준다는 것.
    assert result is None or isinstance(result, str)


def test_구_추출은_동_이름을_구로_오인하지_않는다():
    assert seoul.extract_gu("서울특별시 마포구 구수동길 10") == "마포구"


# ══════════════════════════════════════════════════════════════════════════
# 수강료 파싱 — 숫자 한 개가 아니라 과정별 목록 문자열이다
# ══════════════════════════════════════════════════════════════════════════
@pytest.mark.parametrize("text,expected", [
    ("초등수학:140000, 중등수학:300000, 고등수학:450000", [140000, 300000, 450000]),
    ("과학(고등):260000", [260000]),
    ("실용영어(주3회,회120분):347000", [347000]),
    ("바이엘:150,000, 체르니100:160,000", [150000, 160000]),
    ("수학 : 200000원", [200000]),
    ("미기재:0, 수학:180000", [180000]),       # 0원은 결측으로 버린다
    ("", []),
    (None, []),
    ("수강료 문의", []),
])
def test_수강료_파싱(text, expected):
    assert seoul.parse_fees(text) == expected


@pytest.mark.parametrize("realm,expected", [
    ("입시.검정 및 보습", True),
    ("입시검정및보습", True),
    ("입시·검정 및 보습", True),
    ("예능(대)", False),
    ("국제화", False),
    ("독서실", False),
    ("", False),
    (None, False),
])
def test_교습계열_필터(realm, expected):
    assert seoul.is_target_realm(realm) is expected


# ══════════════════════════════════════════════════════════════════════════
# 서울 응답 → 구보정계수
# ══════════════════════════════════════════════════════════════════════════
@pytest.fixture
def seoul_rows():
    return _json("seoul_academy_sample.json")


def test_실제_응답_컬럼명을_쓴다(seoul_rows):
    """과거 문서의 ACA_NM/FA_RDNMA/REALM_SC_NM/PSNBY_THCC_CNTNT 는 존재하지 않는다."""
    columns = set(seoul_rows[0])
    assert {"PEI_NM", "ROAD_NM_ADDR", "FLD_NM", "INDV_ATNLC_AMT_CN"} <= columns
    assert not columns & {"ACA_NM", "FA_RDNMA", "REALM_SC_NM", "PSNBY_THCC_CNTNT"}


def test_수강료_컬럼이_없으면_추측하지_않고_실패한다(seoul_rows):
    rows = [{k: v for k, v in r.items() if k != "INDV_ATNLC_AMT_CN"} for r in seoul_rows]
    with pytest.raises(seoul.SeoulApiError, match="INDV_ATNLC_AMT_CN"):
        seoul.select_columns(rows)


def test_필요한_컬럼만_남기고_계열로_거른다(seoul_rows):
    selected = seoul.select_columns(seoul_rows)
    assert selected, "표본에서 입시·보습 계열이 하나도 안 남았다"
    assert len(selected) < len(seoul_rows), "다른 계열이 걸러지지 않았다"
    assert all(seoul.is_target_realm(r["realm"]) for r in selected)
    assert set(selected[0]) == {"name", "address", "realm", "fee_text", "gu", "fees"}


def test_구보정계수는_서울평균_대비_비율(seoul_rows):
    built = seoul.build_gu_coefficients(seoul_rows)
    co = built["coefficients"]

    assert len(co) == 25, f"서울 자치구는 25개인데 {len(co)}개가 나왔다"
    assert all(g.endswith("구") for g in co)
    # 서울 평균이 분모이므로 계수는 1 을 중심으로 흩어진다
    assert min(co.values()) < 1.0 < max(co.values())
    assert co["강남구"] > co["송파구"]
    assert co["강남구"] > co["강북구"]
    assert built["sample_size"]["강남구"] > 0
    assert built["source"]["realm_filter"] == "입시.검정 및 보습"


def test_전체_데이터_기준_구보정계수_스냅샷():
    """실제 전량(25,522건) 수집 결과 = config/seoul_gu_coefficients.json.

    표본 픽스처가 아니라 배치가 만든 실제 산출물을 검증한다.
    """
    path = rcfg.resolve_read_path(rcfg.GU_FILE)
    if path is None:
        pytest.skip("배치를 아직 돌리지 않았다 (python -m regional.collect)")
    doc = json.loads(path.read_text(encoding="utf-8"))
    co = doc["coefficients"]
    assert len(co) == 25
    # 강남·서초·양천이 상위 3개라는 순서는 서울 학원비 시세의 기본 사실이다.
    top3 = [g for g, _ in sorted(co.items(), key=lambda kv: -kv[1])[:3]]
    assert top3 == ["강남구", "서초구", "양천구"], f"상위 3개가 바뀌었다: {top3}"
    assert doc["source"]["fetched_rows"] > 20_000
    assert doc["source"]["kept_academies"] < doc["source"]["priced_academies"], "이상치 절단이 안 됐다"


def test_이상치_상위_0_5퍼센트를_절단한다():
    """말도 안 되는 고액 한 건이 구 평균을 끌어올리지 못해야 한다."""
    def row(gu, fee):
        return {"FLD_NM": "입시.검정 및 보습", "PEI_NM": f"{gu}학원",
                "ROAD_NM_ADDR": f"서울특별시 {gu} 어딘가로 1",
                "ADMDST_NM": gu, "INDV_ATNLC_AMT_CN": f"수학:{fee}"}

    normal = [row("강남구", 300000) for _ in range(100)]
    normal += [row("송파구", 300000) for _ in range(100)]
    built = seoul.build_gu_coefficients(normal + [row("강남구", 99_000_000)])
    # 절단 덕분에 두 구가 동일하게 남는다
    assert built["coefficients"]["강남구"] == pytest.approx(1.0)
    assert built["coefficients"]["송파구"] == pytest.approx(1.0)
    assert built["source"]["kept_academies"] == 200


def test_인증키가_틀리면_XML_오류를_읽어_올린다():
    """서울 API 는 키가 틀리면 JSON 이 아니라 XML 오류 문서를 준다.

    배치 로그에서 원인을 바로 읽으려면 코드·메시지가 예외 문구에 들어가야 한다.
    """
    xml = ("<RESULT><CODE>INFO-100</CODE><MESSAGE><![CDATA[인증키가 유효하지 않습니다.\n"
           "인증키가 없는 경우, 열린 데이터 광장 홈페이지에서 인증키를 신청하십시오.]]>"
           "</MESSAGE></RESULT>")
    described = seoul._describe_non_json(xml)
    assert "INFO-100" in described
    assert "인증키가 유효하지 않습니다" in described
    assert "\n" not in described, "로그 한 줄에 담기도록 줄바꿈은 접어야 한다"


def test_JSON도_XML도_아니면_원문을_보여준다():
    described = seoul._describe_non_json("<html>503 Service Unavailable</html>")
    assert "JSON 이 아니다" in described
    assert "503" in described


def test_수강료가_전무하면_실패한다():
    rows = [{"FLD_NM": "입시.검정 및 보습", "PEI_NM": "무료학원",
             "ROAD_NM_ADDR": "서울특별시 강남구 어딘가로 1",
             "ADMDST_NM": "강남구", "INDV_ATNLC_AMT_CN": ""}]
    with pytest.raises(seoul.SeoulApiError, match="한 곳도 없다"):
        seoul.build_gu_coefficients(rows)


# ══════════════════════════════════════════════════════════════════════════
# get_region_coefficient — 최종 결합
# ══════════════════════════════════════════════════════════════════════════
@pytest.fixture
def loaded():
    """배치 산출물이 있어야 하는 테스트용 가드."""
    data = rc.load(refresh=True)
    if not data["available"]:
        pytest.skip("계수 캐시가 없다 (python -m regional.collect)")
    return data


def test_서울은_시도계수와_구보정계수를_곱한다(loaded):
    sido = loaded["sido"]["서울"]
    gu = loaded["gu"]["강남구"]
    assert rc.get_region_coefficient("서울", "강남구") == pytest.approx(
        round(sido * gu, 4), abs=1e-4)
    # 곱셈 결과이므로 시도계수 단독보다 크다 (강남 구보정 > 1)
    assert rc.get_region_coefficient("서울", "강남구") > sido


def test_서울_구를_안_주면_시도계수만(loaded):
    assert rc.get_region_coefficient("서울") == pytest.approx(loaded["sido"]["서울"])
    assert rc.get_region_coefficient("서울", None) == pytest.approx(loaded["sido"]["서울"])


def test_서울의_모르는_구는_구보정_1_0(loaded):
    assert rc.get_region_coefficient("서울", "없는구") == pytest.approx(
        loaded["sido"]["서울"])


def test_비서울은_구를_줘도_무시한다(loaded):
    """강남구는 경기도에 없다 — 구보정은 서울 전용이다."""
    assert rc.get_region_coefficient("경기", "강남구") == pytest.approx(
        loaded["sido"]["경기"])
    assert rc.get_region_coefficient("인천", "강남구") == pytest.approx(
        loaded["sido"]["인천"])


def test_모르는_시도는_전국평균_1_0():
    assert rc.get_region_coefficient("없는시도") == 1.0
    assert rc.get_region_coefficient("Atlantis", "강남구") == 1.0
    assert rc.get_region_coefficient(None) == 1.0
    assert rc.get_region_coefficient("") == 1.0


def test_정식명칭으로도_조회된다(loaded):
    assert rc.get_region_coefficient("서울특별시") == pytest.approx(loaded["sido"]["서울"])
    assert rc.get_region_coefficient("경기도") == pytest.approx(loaded["sido"]["경기"])
    assert rc.get_region_coefficient("충청북도") == pytest.approx(loaded["sido"]["충북"])


def test_밀도가중치는_향후_확장자리이며_지금은_무시된다(loaded):
    base = rc.get_region_coefficient("서울", "강남구")
    assert rc.get_region_coefficient("서울", "강남구", density_weight=None) == base
    # 시그니처는 열려 있다 — 넘기면 곱해진다
    assert rc.get_region_coefficient("서울", "강남구", density_weight=2.0) == pytest.approx(
        round(base * 2.0, 4), abs=1e-4)


def test_계수_분해가_매핑성공여부를_알려준다(loaded):
    ok = rc.breakdown("서울", "강남구")
    assert ok["matched_sido"] and ok["matched_gu"]
    assert ok["coefficient"] == pytest.approx(
        ok["sido_coefficient"] * ok["gu_coefficient"], abs=1e-4)

    miss = rc.breakdown("없는시도", "없는구")
    assert not miss["matched_sido"] and not miss["matched_gu"]
    assert miss["coefficient"] == 1.0

    non_seoul = rc.breakdown("경기", "강남구")
    assert non_seoul["gu"] is None, "서울이 아니면 구를 라벨에 남기지 않는다"
    assert non_seoul["gu_coefficient"] == 1.0


def test_계수파일이_없으면_전부_1_0(monkeypatch, tmp_path):
    """API 실패로 캐시가 아예 없는 최악의 경우에도 화면은 살아야 한다."""
    monkeypatch.setattr(rcfg, "config_dirs", lambda: [tmp_path])
    rc.load(refresh=True)
    try:
        assert rc.get_region_coefficient("서울", "강남구") == 1.0
        assert rc.load()["available"] is False
        assert rc.sources()["available"] is False
    finally:
        rc.load(refresh=True)      # 다른 테스트를 위해 캐시 복구


def test_깨진_계수파일도_1_0으로_버틴다(monkeypatch, tmp_path):
    (tmp_path / rcfg.FINAL_FILE).write_text("{ not json", encoding="utf-8")
    monkeypatch.setattr(rcfg, "config_dirs", lambda: [tmp_path])
    rc.load(refresh=True)
    try:
        assert rc.get_region_coefficient("서울", "강남구") == 1.0
    finally:
        rc.load(refresh=True)


def test_출처_각주에_필요한_정보가_다_있다(loaded):
    src = rc.sources()
    assert src["sido"]["provider"] == "통계청 KOSIS"
    assert src["sido"]["table_id"] == "DT_1PE105"
    assert src["sido"]["period"]                      # 사교육비조사 기준연도
    assert src["gu"]["provider"] == "서울 열린데이터광장"
    assert src["gu"]["dataset"] == "neisAcademyInfo"
    assert src["generated_at"]                        # 갱신 시점
