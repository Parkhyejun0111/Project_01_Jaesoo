"""돈워리 탭 × 지역계수 연동 테스트.

  표시 비용 = 기준 평균 비용(COST_FORMS[form]["total"]) × 지역계수

레거시 4단 시세 배율(COST_REGIONS)은 폴백으로 남아 있고, 그 경로의 회귀는
test_costs_and_api.py 가 이미 잠가 두었다. 여기서는 새 경로만 본다.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import costs  # noqa: E402
import main  # noqa: E402
from regional import coefficients as rc  # noqa: E402

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def require_cache():
    if not rc.load(refresh=True)["available"]:
        pytest.skip("계수 캐시가 없다 (python -m regional.collect)")


# ══════════════════════════════════════════════════════════════════════════
# 비용 환산
# ══════════════════════════════════════════════════════════════════════════
def test_표시비용은_기준비용에_지역계수를_곱한_값():
    base = costs.COST_FORMS["재수종합학원"]["total"]
    coefficient = rc.get_region_coefficient("서울", "강남구")
    r = costs.estimate(form="재수종합학원", sido="서울", gu="강남구")

    assert r["national_total"] == base
    assert r["adjust_pct"] == round(coefficient * 100)
    assert r["total"] == round(base * round(coefficient * 100) / 100)
    assert r["region_coefficient"]["coefficient"] == pytest.approx(coefficient)


def test_전국평균_대비_배율을_함께_준다():
    r = costs.estimate(form="기숙학원", sido="서울", gu="강남구")
    assert r["vs_national"] == pytest.approx(r["total"] / r["national_total"], abs=0.01)
    assert r["vs_national"] > 1.5      # 강남은 전국 평균의 2배 안팎

    cheap = costs.estimate(form="기숙학원", sido="전남")
    assert cheap["vs_national"] < 1.0


def test_지역이_비쌀수록_표시비용이_크다():
    def total(sido, gu=None):
        return costs.estimate(form="재수종합학원", sido=sido, gu=gu)["total"]

    assert total("서울", "강남구") > total("서울", "강북구") > total("경기") > total("전남")


def test_서울_밖은_구를_줘도_시도계수만_적용된다():
    with_gu = costs.estimate(form="단과 통학", sido="경기", gu="강남구")
    without = costs.estimate(form="단과 통학", sido="경기")
    assert with_gu["total"] == without["total"]
    assert with_gu["region_coefficient"]["gu_coefficient"] == 1.0
    assert with_gu["region"] == "경기", "서울이 아니면 라벨에 구를 붙이지 않는다"


def test_불명_지역은_전국평균_1_0으로_떨어진다():
    """신규·불명 지역이 와도 화면이 죽지 않고 전국 평균을 보여준다."""
    r = costs.estimate(form="재수종합학원", sido="없는지역")
    assert r["region_coefficient"]["coefficient"] == 1.0
    assert r["region_coefficient"]["matched_sido"] is False
    assert r["total"] == costs.COST_FORMS["재수종합학원"]["total"]
    assert r["vs_national"] == 1.0
    assert r["region"] == "없는지역", "정규화가 사용자 입력을 뭉개면 안 된다"


def test_보장분과_자기부담의_합은_지역계수를_써도_총액():
    for sido, gu in [("서울", "강남구"), ("서울", None), ("경기", None), ("전남", None)]:
        r = costs.estimate(form="기숙학원", sido=sido, gu=gu)
        assert r["covered"] + r["self_pay"] == r["total"]
        assert r["self_pay"] >= 0


def test_adjust_pct_가_지역계수보다_우선한다():
    """사용자가 슬라이더를 직접 만졌으면 그 값이 이긴다."""
    r = costs.estimate(form="재수종합학원", sido="서울", gu="강남구", adjust_pct=100)
    assert r["adjust_pct"] == 100
    assert r["total"] == costs.COST_FORMS["재수종합학원"]["total"]


def test_시도를_안_주면_레거시_시세배율_경로():
    r = costs.estimate(form="재수종합학원", region="서울 학군지")
    assert r["adjust_pct"] == 120
    assert r["total"] == 2292
    assert "region_coefficient" not in r, "레거시 경로에는 계수 정보가 붙지 않는다"


# ══════════════════════════════════════════════════════════════════════════
# 카탈로그 · 엔드포인트
# ══════════════════════════════════════════════════════════════════════════
def test_카탈로그에_거주지_선택지가_있다():
    body = client.get("/api/cost-forms").json()
    region = body["region_coefficients"]

    assert len(region["sido"]) == 17
    assert len(region["seoul_gu"]) == 25
    assert region["available"] is True
    # 계수 큰 순 정렬 — 화면이 그대로 그린다
    assert region["sido"][0]["name"] == "서울"
    assert region["seoul_gu"][0]["name"] == "강남구"
    coefficients = [s["coefficient"] for s in region["sido"]]
    assert coefficients == sorted(coefficients, reverse=True)
    assert region["default_sido"] == costs.DEFAULT_SIDO

    # 레거시 4단 배율도 그대로 남아 있다 (하위호환)
    assert len(body["regions"]) == 4


def test_카탈로그_각주에_출처와_갱신시점이_있다():
    src = client.get("/api/cost-forms").json()["region_coefficients"]["sources"]
    assert src["sido"]["provider"] == "통계청 KOSIS"
    assert src["sido"]["table_id"] == "DT_1PE105"
    assert src["sido"]["period"]
    assert src["gu"]["provider"] == "서울 열린데이터광장"
    assert src["generated_at"]


def test_cost_estimate_엔드포인트가_시도_구를_받는다():
    body = client.get("/api/cost-estimate", params={
        "form": "재수종합학원", "sido": "서울", "gu": "강남구"}).json()
    assert body["region"] == "서울 강남구"
    assert body["region_coefficient"]["matched_gu"] is True
    assert body["vs_national"] > 1.5


def test_region_coefficients_엔드포인트():
    body = client.get("/api/region-coefficients").json()
    assert len(body["sido_coefficients"]) == 17
    assert len(body["seoul_gu_coefficients"]) == 25
    assert body["default"] == 1.0
    assert "selected" not in body

    picked = client.get("/api/region-coefficients",
                        params={"sido": "서울", "gu": "송파구"}).json()
    assert picked["selected"]["gu"] == "송파구"
    assert picked["selected"]["coefficient"] == pytest.approx(
        body["sido_coefficients"]["서울"] * body["seoul_gu_coefficients"]["송파구"],
        abs=1e-3)


def test_지역계수는_보험료에_영향을_주지_않는다():
    """돈워리는 요율과 무관하다 — engine 의 학원밀집도지수와 섞이면 안 된다."""
    import engine

    base = {"tier": "스탠다드", "household_income_manwon": 500,
            "academy_density_index": 3, "monthly_edu_cost_manwon": 60}
    before = engine.price(base)["monthly_premium"]
    costs.estimate(form="기숙학원", sido="서울", gu="강남구")
    assert engine.price(base)["monthly_premium"] == before
