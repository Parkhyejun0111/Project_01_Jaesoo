"""돈워리 계산기 + 신규 API 엔드포인트 회귀 테스트."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import costs
import engine
import main

client = TestClient(main.app)


# ══════════════════════════════════════════════════════════════════════════
# 돈워리 계산기 (레거시 SPA 로직 이식 검증)
# ══════════════════════════════════════════════════════════════════════════
def test_레거시_기본값_재현():
    """레거시 SPA·jaehee 앱이 하드코딩하던 값 — 재수종합학원 · 서울 학군지 → 2,292만원.

    jaehee `Converter` 의 `comparisonAmount = 2292` 와 `Math.min(1400, …)` 이
    바로 이 입력 조합의 결과다.
    """
    r = costs.estimate(form="재수종합학원", region="서울 학군지")
    assert r["adjust_pct"] == 120
    assert r["total"] == 2292
    assert r["covered"] == 1400
    assert r["self_pay"] == 892
    assert r["covered"] + r["self_pay"] == r["total"]


@pytest.mark.parametrize("form", list(costs.COST_FORMS))
def test_보장분과_자기부담의_합이_총액(form):
    for region in [r["name"] for r in costs.COST_REGIONS]:
        r = costs.estimate(form=form, region=region)
        assert r["covered"] + r["self_pay"] == r["total"]
        assert r["self_pay"] >= 0


def test_지역_시세_배율():
    assert costs.region_pct("서울 학군지") == 120
    assert costs.region_pct("수도권") == 100
    assert costs.region_pct("지방") == 85
    assert costs.region_pct(None) == 100
    assert costs.region_pct("없는지역") == 100


def test_지역이_비쌀수록_총액이_크다():
    totals = [costs.estimate(form="기숙학원", region=r["name"])["total"]
              for r in sorted(costs.COST_REGIONS, key=lambda x: x["pct"])]
    assert totals == sorted(totals)


def test_평균_대체_여부를_표시한다():
    auto = costs.estimate(form="단과 통학")
    assert auto["used_average"]["monthly_saving"] is True
    assert auto["conversions"]["saving_months"] == max(
        round(auto["total"] / costs.SAVE_AVG), 1)

    given = costs.estimate(form="단과 통학", monthly_saving=300)
    assert given["used_average"]["monthly_saving"] is False
    assert given["conversions"]["saving_months"] == max(round(given["total"] / 300), 1)


def test_저축개월은_최소_1():
    r = costs.estimate(form="독학재수(독서실·인강)", monthly_saving=300)
    assert r["conversions"]["saving_months"] >= 1


def test_형제가_2명_이상일_때만_등록금_환산():
    assert "tuition_semesters" not in costs.estimate(form="재수종합학원")["conversions"]
    assert "tuition_semesters" not in costs.estimate(
        form="재수종합학원", sibling_count=1)["conversions"]
    r = costs.estimate(form="재수종합학원", sibling_count=2)
    assert r["conversions"]["tuition_semesters"] == pytest.approx(
        round(r["total"] / costs.SEMESTER_COST * 2) / 2)


def test_노후목표는_주어질_때만_환산():
    assert "retirement_pct" not in costs.estimate(form="기숙학원")["conversions"]
    r = costs.estimate(form="기숙학원", retire_goal=40000)
    assert r["conversions"]["retirement_pct"] == round(r["total"] / 40000 * 100)


def test_알_수_없는_형태는_기본값으로():
    assert costs.estimate(form="없는형태")["form"] == costs.DEFAULT_FORM


def test_돈워리_지역과_요율_지역규모는_다른_개념():
    """섞어 쓰면 요율이 오염된다 — 두 목록의 이름이 겹치지 않아야 한다."""
    cost_names = {r["name"] for r in costs.COST_REGIONS}
    rate_names = {r["value"] for r in engine.REGION_CHOICES}
    assert not (cost_names & rate_names)


def test_돈워리는_보험료에_영향을_주지_않는다():
    base = engine.price({"tier": "스탠다드", "household_income_manwon": 500,
                         "academy_density_index": 3, "monthly_edu_cost_manwon": 60})
    with_cost = engine.price({"tier": "스탠다드", "household_income_manwon": 500,
                              "academy_density_index": 3, "monthly_edu_cost_manwon": 60,
                              "monthly_saving": 300, "retire_goal": 80000})
    assert base["monthly_premium"] == with_cost["monthly_premium"]


# ══════════════════════════════════════════════════════════════════════════
# 신규 API — DB 없이 동작해야 하는 것들
# ══════════════════════════════════════════════════════════════════════════
def test_health():
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert "provider" in body and "db" in body


def test_tiers_기본은_고1_3월():
    body = client.get("/api/tiers").json()
    assert body["remaining_months"] == 33
    assert body["late"] == 0.0
    assert body["theta"] == pytest.approx(engine.THETA_BASE)
    prem = {t["tier"]: t["monthly_premium"] for t in body["tiers"]}
    assert prem == {"라이트": 1808, "스탠다드": 3262, "플러스": 5209, "프리미엄": 7622}


def test_tiers_가입시점을_반영한다():
    early = client.get("/api/tiers?remaining_months=33").json()
    late = client.get("/api/tiers?remaining_months=6").json()
    assert late["theta"] > early["theta"]
    for a, b in zip(early["tiers"], late["tiers"]):
        assert b["monthly_premium"] > a["monthly_premium"]
        assert b["cover_severe"] == a["cover_severe"]   # 보장금은 시점 무관 (별표2 ※)


def test_tiers_범위를_벗어난_잔여개월은_클램프():
    assert client.get("/api/tiers?remaining_months=99").json()["remaining_months"] == 33
    assert client.get("/api/tiers?remaining_months=1").json()["remaining_months"] == 6


def test_quote_조견표():
    body = client.get("/api/quote").json()
    assert len(body["windows"]) == len(engine.ENROLL_WINDOWS)
    assert body["windows"][0]["remaining_months"] == 33
    assert body["windows"][-1]["remaining_months"] == 6
    assert "고3 6월" in body["deadline"]
    premiums = [w["premiums"]["스탠다드"] for w in body["windows"]]
    assert premiums == sorted(premiums)


def test_regions_선택지():
    body = client.get("/api/regions").json()
    assert [r["value"] for r in body["regions"]] == ["특별시", "대도시", "중소도시", "읍면지역"]
    assert [r["density"] for r in body["regions"]] == [4, 3, 2, 1]
    assert body["default"] == engine.DEFAULT_REGION


def test_cost_forms_카탈로그():
    body = client.get("/api/cost-forms").json()
    assert len(body["forms"]) == 4
    assert len(body["regions"]) == 4
    assert body["averages"]["monthly_saving"] == costs.SAVE_AVG
    assert set(body["options"]) == {"saving", "sibling", "retirement", "income"}
    assert body["unit"] == "만원"


def test_cost_estimate_엔드포인트():
    body = client.get("/api/cost-estimate",
                      params={"form": "재수종합학원", "region": "서울 학군지",
                              "sibling_count": 2, "retire_goal": 40000}).json()
    assert body["total"] == 2292
    assert body["conversions"]["tuition_semesters"] > 0
    assert body["conversions"]["retirement_pct"] > 0


def test_policy_sections_목차():
    body = client.get("/api/policy/sections").json()
    assert body["sections"] == []
    assert len(body["toc"]) >= 70
    assert all({"anchor", "title", "index"} <= set(row) for row in body["toc"])


def test_policy_sections_앵커_조회():
    import rag_light as R
    anchor = next(s["anchor"] for s in R._document_sections()
                  if s["anchor"].startswith("별표4-위험확률-및-보험료-산출"))
    body = client.get("/api/policy/sections", params={"a": anchor}).json()
    assert len(body["sections"]) == 1
    assert body["sections"][0]["found"] is True
    assert "1.8720%" in body["sections"][0]["text"]


def test_policy_sections_여러_앵커():
    import rag_light as R
    anchors = [s["anchor"] for s in R._document_sections()[:3]]
    body = client.get("/api/policy/sections", params={"a": ",".join(anchors)}).json()
    assert len(body["sections"]) == 3


def test_policy_pages_는_하위호환으로_남아있다():
    body = client.get("/api/policy/pages?p=1,2").json()
    assert len(body["pages"]) == 2
    assert body["pages"][0]["anchor"]      # 앵커도 함께 반환


def test_scores_응답이_백분위_스케일임을_알린다():
    """DB 가 없으면 scores 는 비지만, 스케일·판정 과목 메타는 항상 와야 한다."""
    body = client.get("/api/student/stu_none/scores").json()
    assert body.get("scale") == "percentile" or "error" in body


def test_chat_빈_질문():
    body = client.post("/api/chat", json={"message": "  "}).json()
    assert body["sources"] == []
    assert body["llm"] is False


def test_chat_는_LLM_없이도_약관_발췌로_답한다():
    body = client.post("/api/chat", json={"message": "청약철회는 어떻게 하나요?"}).json()
    assert body["answer"]
    assert body["sources"], "출처가 비어 있으면 검색이 실패한 것"
    for s in body["sources"]:
        assert s["anchor"] and s["title"]


# ══════════════════════════════════════════════════════════════════════════
# 챗봇 개인화 컨텍스트 — 민감정보 노출 금지
# ══════════════════════════════════════════════════════════════════════════
def test_구성분해_표가_프롬프트에_실린다():
    bd = engine.premium_breakdown("스탠다드")
    table = main._breakdown_table(bd)
    assert "위험보험료" in table and "사업비" in table and "위험마진" in table
    assert table.count("\n") == 2          # 3행
    for line in table.splitlines():
        assert line.count("|") == 4        # | 항목 | 금액 | 비중 |


def test_프롬프트에_요율지표와_확률이_없다():
    bd = engine.premium_breakdown("프리미엄", 6)
    table = main._breakdown_table(bd)
    for banned in ("가구소득", "학원밀집도", "월교육비", "재수확률", "급락확률", "σ", "logit"):
        assert banned not in table
