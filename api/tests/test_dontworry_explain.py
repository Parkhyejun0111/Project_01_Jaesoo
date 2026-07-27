"""돈워리 "왜 이 금액인가요?" 설명 챗봇 테스트.

네트워크를 타지 않는다. LLM 호출은 스텁 클라이언트로 대체한다 — 실제 Anthropic
호출은 `scripts/review-explain-samples.py` 로 따로 검수한다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import costs  # noqa: E402
import dontworry_explain as dx  # noqa: E402
import explain_cache  # noqa: E402
import main  # noqa: E402
from regional import coefficients as rc  # noqa: E402

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def clean_cache_and_coefficients():
    """계수 캐시가 있어야 하고, 문구 캐시는 테스트마다 비운다."""
    explain_cache.clear_memory()
    if not rc.load(refresh=True)["available"]:
        pytest.skip("지역계수 캐시가 없다 (python -m regional.collect)")
    yield
    explain_cache.clear_memory()


@pytest.fixture(autouse=True)
def no_db(monkeypatch):
    """DB 를 끈 상태로 고정 — 캐시 2층과 거주지 조회가 네트워크를 타지 않게."""
    import db_supabase as db

    monkeypatch.setattr(db, "enabled", lambda: False)


# ══════════════════════════════════════════════════════════════════════════
# 스텁 LLM — Anthropic tool_use 2-turn 패턴을 흉내낸다
# ══════════════════════════════════════════════════════════════════════════
class _Block:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class _Response:
    def __init__(self, content, stop_reason="end_turn"):
        self.content = content
        self.stop_reason = stop_reason


class StubClient:
    """tool_choice 를 보고 응답 종류를 정하는 최소 스텁.

    호출 횟수로 분기하면 explain_dontworry 를 두 번 부르는 테스트에서 3번째 호출이
    엉뚱한 응답을 받는다. 실제 API 처럼 "툴을 강제하면 tool_use, 막으면 텍스트"로
    분기하는 게 정확하다.

    calls 에 요청 kwargs 를 쌓아 두므로 tool_choice·thinking 설정까지 검증 가능하다.
    """

    def __init__(self, answer: str = "설명입니다.", *, fail_on: int | None = None):
        self.answer = answer
        self.fail_on = fail_on
        self.calls: list[dict] = []
        self.messages = self          # client.messages.create 로 접근되므로

    def create(self, **kw):
        self.calls.append(kw)
        if self.fail_on == len(self.calls):
            raise RuntimeError("LLM 폭발")
        if (kw.get("tool_choice") or {}).get("type") == "tool":
            return _Response([_Block(type="tool_use", id="toolu_1",
                                     name=dx.TOOL_NAME,
                                     input={"user_id": "stu_1", "재수유형": "재종합학원"})],
                             stop_reason="tool_use")
        return _Response([_Block(type="text", text=self.answer)])


#   monkeypatch 로 dx._generate 를 갈아끼우므로 원본을 미리 붙잡아 둔다.
#   붙잡지 않고 dx._generate 를 부르면 패치된 자신을 다시 불러 무한 재귀가 된다.
_REAL_GENERATE = dx._generate


def _stub_generate(stub: StubClient):
    """dx._generate 를 스텁 클라이언트로 돌리는 대체 함수."""
    def _run(breakdown, user_id, 재수유형, *, client=None):
        return _REAL_GENERATE(breakdown, user_id, 재수유형, client=stub)
    return _run


# ══════════════════════════════════════════════════════════════════════════
# 1. get_dontworry_breakdown — 캐시된 계수와 정확히 일치해야 한다
# ══════════════════════════════════════════════════════════════════════════
def test_브레이크다운이_계수파일과_일치한다():
    """region_coefficients_final.json 의 값을 그대로 조회할 뿐 재계산하지 않는다."""
    data = rc.load()
    b = dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="서울", gu="강남구")

    assert b["시도계수"] == pytest.approx(data["sido"]["서울"])
    assert b["구보정계수"] == pytest.approx(data["gu"]["강남구"])
    assert b["최종지역계수"] == pytest.approx(
        round(data["sido"]["서울"] * data["gu"]["강남구"], 4))
    # 기준 평균비용은 costs 테이블 그대로
    assert b["전국평균비용_만원"] == costs.COST_FORMS["재수종합학원"]["total"]
    assert b["기준시점"] == (data["generated_at"] or "")[:7]


def test_금액은_화면과_같은_함수로_계산한다():
    """금액을 여기서 다시 곱하면 반올림 순서가 달라져 화면과 어긋난다.

    한때 설명이 3,944만원, 화면이 3,954만원으로 갈렸다. costs.estimate 하나만
    쓰는지 잠가 둔다.
    """
    for sido, gu, form, key in [("서울", "강남구", "재종합학원", "재수종합학원"),
                                ("서울", None, "기숙학원", "기숙학원"),
                                ("경기", None, "단과통학", "단과 통학"),
                                ("전남", None, "독학재수", "독학재수(독서실·인강)")]:
        b = dx.get_dontworry_breakdown("stu_1", form, sido=sido, gu=gu)
        estimate = costs.estimate(form=key, sido=sido, gu=gu)
        assert b["최종예상비용_만원"] == estimate["total"], (sido, gu, form)
        assert b["전국평균비용_만원"] == estimate["national_total"]
        assert b["비율_퍼센트"] == estimate["adjust_pct"] - 100


def test_비율은_전국평균_대비_증감률():
    b = dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="서울", gu="강남구")
    assert b["비율_퍼센트"] == round((b["최종지역계수"] - 1) * 100)
    assert b["비율_퍼센트"] > 0

    cheap = dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="전남")
    assert cheap["비율_퍼센트"] < 0, "전남은 전국 평균보다 싸다"


def test_서울밖은_구보정계수가_1이고_구가_비어있다():
    b = dx.get_dontworry_breakdown("stu_1", "단과통학", sido="경기", gu="강남구")
    assert b["구보정계수"] == 1.0
    assert b["구"] is None
    assert b["최종지역계수"] == pytest.approx(b["시도계수"])


def test_불명지역은_전국평균이고_매핑실패를_알린다():
    b = dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="없는지역")
    assert b["최종지역계수"] == 1.0
    assert b["지역매핑성공"] is False
    assert b["최종예상비용_만원"] == b["전국평균비용_만원"]


@pytest.mark.parametrize("short,long_key", list(dx.FORM_KEYS.items()))
def test_재수유형_네가지_모두_조회된다(short, long_key):
    b = dx.get_dontworry_breakdown("stu_1", short, sido="경기")
    assert b["재수유형"] == short
    assert b["전국평균비용_만원"] == costs.COST_FORMS[long_key]["total"]


def test_긴_이름으로도_받아준다():
    b = dx.get_dontworry_breakdown("stu_1", "재수종합학원", sido="경기")
    assert b["재수유형"] == "재종합학원"


def test_알수없는_재수유형은_거부한다():
    with pytest.raises(dx.ExplainError, match="알 수 없는 재수유형"):
        dx.get_dontworry_breakdown("stu_1", "인터넷강의", sido="경기")


def test_학군지판정은_구보정계수로_한다():
    """고정 목록이 아니라 실측 수강료 계수로 판정한다."""
    gangnam = dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="서울", gu="강남구")
    gangbuk = dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="서울", gu="강북구")
    assert gangnam["학군지여부"] is True
    assert gangbuk["학군지여부"] is False
    # 서울 밖은 구보정이 1.0 이므로 학군지가 될 수 없다
    assert dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="경기")["학군지여부"] is False


def test_학군지는_상위_세개_구만():
    """임계값 1.15 는 대치·서초·목동을 잡는 선이다 — 데이터가 흔들리면 알려야 한다."""
    seoul_gu = rc.load()["gu"]
    districts = sorted(g for g, c in seoul_gu.items()
                       if c >= dx.SCHOOL_DISTRICT_THRESHOLD)
    assert districts == ["강남구", "서초구", "양천구"], districts


# ══════════════════════════════════════════════════════════════════════════
# 2. 캐시 — 같은 조합이면 LLM 을 다시 부르지 않는다
# ══════════════════════════════════════════════════════════════════════════
def test_같은_조합_반복호출은_LLM을_한번만_부른다(monkeypatch):
    stub = StubClient("서울 강남구는 계수가 높아 예상 비용이 큽니다.")
    monkeypatch.setattr(dx, "_generate", _stub_generate(stub))

    first = dx.explain_dontworry("stu_1", "재종합학원", sido="서울", gu="강남구")
    assert first["source"] == "llm"
    turns_after_first = len(stub.calls)
    assert turns_after_first == 2, "tool_use 2-turn 패턴이어야 한다"

    for _ in range(3):
        again = dx.explain_dontworry("stu_1", "재종합학원", sido="서울", gu="강남구")
        assert again["source"] == "cache"
        assert again["answer"] == first["answer"]

    assert len(stub.calls) == turns_after_first, "캐시 히트인데 LLM 을 다시 불렀다"


def test_지역을_바꾸면_캐시가_갈린다(monkeypatch):
    """캐시 키에 시도·구가 없으면 강남구 설명이 강북구 사용자에게 나간다."""
    stub = StubClient("설명입니다.")
    monkeypatch.setattr(dx, "_generate", _stub_generate(stub))

    dx.explain_dontworry("stu_1", "재종합학원", sido="서울", gu="강남구")
    assert dx.explain_dontworry("stu_1", "재종합학원", sido="서울", gu="강북구")["source"] == "llm"
    assert dx.explain_dontworry("stu_1", "재종합학원", sido="경기")["source"] == "llm"


def test_재수유형을_바꾸면_캐시가_갈린다(monkeypatch):
    stub = StubClient("설명입니다.")
    monkeypatch.setattr(dx, "_generate", _stub_generate(stub))

    dx.explain_dontworry("stu_1", "재종합학원", sido="경기")
    assert dx.explain_dontworry("stu_1", "기숙학원", sido="경기")["source"] == "llm"


def test_사용자를_바꾸면_캐시가_갈린다(monkeypatch):
    stub = StubClient("설명입니다.")
    monkeypatch.setattr(dx, "_generate", _stub_generate(stub))

    dx.explain_dontworry("stu_1", "재종합학원", sido="경기")
    assert dx.explain_dontworry("stu_2", "재종합학원", sido="경기")["source"] == "llm"


def test_계수가_갱신되면_캐시키가_바뀐다():
    """기준시점이 키에 들어가므로 월간 배치가 돌면 저절로 무효화된다."""
    b = dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="서울", gu="강남구")
    old = dx.cache_key("stu_1", "재종합학원", b)
    new = dx.cache_key("stu_1", "재종합학원", {**b, "기준시점": "2026-08"})
    assert old != new
    assert "2026-07" in old and "2026-08" in new


def test_폴백문구는_캐시하지_않는다(monkeypatch):
    """LLM 이 죽었을 때의 템플릿을 30일 붙잡아두면 복구돼도 계속 템플릿이 나간다."""
    stub = StubClient(fail_on=1)
    monkeypatch.setattr(dx, "_generate", _stub_generate(stub))

    first = dx.explain_dontworry("stu_1", "재종합학원", sido="경기")
    assert first["source"] == "fallback"

    healthy = StubClient("이제 정상 응답입니다.")
    monkeypatch.setattr(dx, "_generate", _stub_generate(healthy))
    second = dx.explain_dontworry("stu_1", "재종합학원", sido="경기")
    assert second["source"] == "llm", "폴백이 캐시돼 LLM 재시도를 막았다"


def test_캐시_TTL이_지나면_미스():
    explain_cache.set_cache("k", "value", ttl_days=30)
    assert explain_cache.get_cache("k") == "value"
    # 음수 TTL 은 하한(60초)으로 잡히므로 만료 검증은 내부 상태를 직접 만진다
    explain_cache._memory["k2"] = ("stale", 0.0)
    assert explain_cache.get_cache("k2") is None


def test_메모리캐시는_상한을_넘지_않는다():
    for i in range(explain_cache.MAX_MEMORY_ENTRIES + 100):
        explain_cache.set_cache(f"key-{i}", "v")
    assert explain_cache.memory_size() <= explain_cache.MAX_MEMORY_ENTRIES


# ══════════════════════════════════════════════════════════════════════════
# 3. 폴백 템플릿
# ══════════════════════════════════════════════════════════════════════════
def test_폴백템플릿_서울은_두_계수를_모두_보여준다():
    b = dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="서울", gu="강남구")
    text = dx.fallback_template(b)
    assert "서울 강남구" in text
    assert str(b["시도계수"]) in text and str(b["구보정계수"]) in text
    assert f"{b['최종예상비용_만원']:,}만원" in text
    assert "높은" in text
    assert "학군지" in text


def test_폴백템플릿_비서울은_구보정을_언급하지_않는다():
    b = dx.get_dontworry_breakdown("stu_1", "단과통학", sido="경기")
    text = dx.fallback_template(b)
    assert "구보정계수" not in text, "서울이 아니면 1.0 을 억지로 넣지 않는다"
    assert "경기" in text


def test_폴백템플릿_싼_지역은_낮은으로_말한다():
    b = dx.get_dontworry_breakdown("stu_1", "독학재수", sido="전남")
    text = dx.fallback_template(b)
    assert "낮은" in text and "높은" not in text
    assert "-" not in text.split("보다")[1], "음수 기호가 노출되면 안 된다"


def test_폴백템플릿_불명지역():
    b = dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="없는지역")
    text = dx.fallback_template(b)
    assert "확인할 수 없어" in text
    assert "전국 평균" in text


@pytest.mark.parametrize("number,expected", [
    ("2.0651", "이"),   # …일 → 받침 있음
    ("1.45", "가"),     # …오 → 받침 없음
    ("1.0906", "이"),   # …육
    ("0.6752", "가"),   # …이
    ("1.1336", "이"),   # …육
    ("1.3", "가"),      # …삼? → 3 은 받침 있음
])
def test_숫자뒤_조사가_읽는소리에_맞는다(number, expected):
    if number == "1.3":
        expected = "이"     # 삼 → 받침 있음
    assert dx._subject_particle(number) == expected


def test_모든_조합의_폴백문구가_예외없이_만들어진다():
    for form in dx.FORM_KEYS:
        for sido, gu in [("서울", "강남구"), ("서울", None), ("경기", None),
                         ("전남", None), ("없는곳", None)]:
            b = dx.get_dontworry_breakdown("stu_1", form, sido=sido, gu=gu)
            text = dx.fallback_template(b)
            assert text and text.endswith(("요.", "에요.", "요")), text


# ══════════════════════════════════════════════════════════════════════════
# 4. 환각 방어 — 툴 반환값에 없는 숫자는 화면에 못 나간다
# ══════════════════════════════════════════════════════════════════════════
@pytest.fixture
def gangnam():
    return dx.get_dontworry_breakdown("stu_1", "재종합학원", sido="서울", gu="강남구")


def test_툴값만_쓴_응답은_통과한다(gangnam):
    text = (f"서울 시도계수 {gangnam['시도계수']}에 강남구 구보정계수 "
            f"{gangnam['구보정계수']}를 곱해 {gangnam['최종지역계수']}가 적용됐어요. "
            f"그래서 전국 평균보다 {gangnam['비율_퍼센트']}% 높은 "
            f"{gangnam['최종예상비용_만원']:,}만원이에요.")
    ok, invented = dx._numbers_are_grounded(text, gangnam)
    assert ok, invented


def test_지어낸_숫자는_잡힌다(gangnam):
    ok, invented = dx._numbers_are_grounded(
        "강남구는 학원이 8,321곳이라 비쌉니다.", gangnam)
    assert not ok
    assert "8321" in [n.replace(",", "") for n in invented]


def test_반올림_표현은_허용한다(gangnam):
    """1.4242 를 '약 1.4배'로 말하는 것은 환각이 아니다."""
    ok, _ = dx._numbers_are_grounded("구보정계수는 약 1.4배예요.", gangnam)
    assert ok


def test_계수를_퍼센트로_옮긴_표현도_허용한다(gangnam):
    ok, _ = dx._numbers_are_grounded(
        f"서울은 전국 평균보다 사교육비가 45% 높아요.", gangnam)
    assert ok, "1.45 → 45% 는 유도 가능한 표현이다"


def test_환각응답은_폴백으로_대체된다(monkeypatch):
    stub = StubClient("강남구에는 학원이 정확히 9,999곳 있어서 비쌉니다.")
    monkeypatch.setattr(dx, "_generate", _stub_generate(stub))

    result = dx.explain_dontworry("stu_1", "재종합학원", sido="서울", gu="강남구")
    assert result["source"] == "fallback"
    assert "9,999" not in result["answer"]
    assert "시도계수" in result["answer"]


# ══════════════════════════════════════════════════════════════════════════
# 5. LLM 호출 형태 — 결정성 보장 장치가 실제로 걸려 있는가
# ══════════════════════════════════════════════════════════════════════════
def test_첫턴은_툴호출을_강제한다(monkeypatch):
    stub = StubClient("설명입니다.")
    monkeypatch.setattr(dx, "_generate", _stub_generate(stub))
    dx.explain_dontworry("stu_1", "재종합학원", sido="경기")

    first, second = stub.calls
    assert first["tool_choice"] == {"type": "tool", "name": dx.TOOL_NAME}
    assert second["tool_choice"] == {"type": "none"}, "둘째 턴엔 툴을 막아야 텍스트가 나온다"


def test_사고는_끄고_effort는_낮춘다(monkeypatch):
    stub = StubClient("설명입니다.")
    monkeypatch.setattr(dx, "_generate", _stub_generate(stub))
    dx.explain_dontworry("stu_1", "재종합학원", sido="경기")

    for call in stub.calls:
        assert call["thinking"] == {"type": "disabled"}
        assert call["output_config"] == {"effort": "low"}
        assert call["max_tokens"] == dx.MAX_TOKENS
        # Sonnet 5 는 비기본 샘플링 파라미터를 400 으로 거절한다
        assert not {"temperature", "top_p", "top_k"} & set(call)


def test_툴결과는_서버가_계산한_값이다(monkeypatch):
    """LLM 이 다른 user_id 를 넣어도 서버 값으로 조회한다 (프롬프트 인젝션 차단)."""
    class Hijack(StubClient):
        def create(self, **kw):
            self.calls.append(kw)
            if len(self.calls) == 1:
                return _Response([_Block(type="tool_use", id="toolu_1", name=dx.TOOL_NAME,
                                         input={"user_id": "victim", "재수유형": "기숙학원"})],
                                 stop_reason="tool_use")
            return _Response([_Block(type="text", text="설명입니다.")])

    stub = Hijack()
    monkeypatch.setattr(dx, "_generate", _stub_generate(stub))
    dx.explain_dontworry("stu_1", "재종합학원", sido="경기")

    tool_result = stub.calls[1]["messages"][-1]["content"][0]
    payload = json.loads(tool_result["content"])
    # 서버가 요청받은 재종합학원(경기) 값이 들어가야 한다 — 기숙학원/victim 이 아니다
    assert payload["재수유형"] == "재종합학원"
    assert payload["전국평균비용_만원"] == costs.COST_FORMS["재수종합학원"]["total"]


def test_거부응답은_폴백으로(monkeypatch):
    class Refusing(StubClient):
        def create(self, **kw):
            self.calls.append(kw)
            if len(self.calls) == 1:
                return _Response([_Block(type="tool_use", id="t", name=dx.TOOL_NAME,
                                         input={})], stop_reason="tool_use")
            return _Response([], stop_reason="refusal")

    monkeypatch.setattr(dx, "_generate", _stub_generate(Refusing()))
    result = dx.explain_dontworry("stu_1", "재종합학원", sido="경기")
    assert result["source"] == "fallback"


def test_툴호출이_안오면_폴백(monkeypatch):
    class NoTool(StubClient):
        def create(self, **kw):
            self.calls.append(kw)
            return _Response([_Block(type="text", text="툴 안 씀")])

    monkeypatch.setattr(dx, "_generate", _stub_generate(NoTool()))
    result = dx.explain_dontworry("stu_1", "재종합학원", sido="경기")
    assert result["source"] == "fallback"


def test_API키가_없으면_폴백():
    """키 없는 환경(로컬·CI)에서도 오류 화면이 아니라 문구가 나온다."""
    result = dx.explain_dontworry("stu_1", "재종합학원", sido="서울", gu="강남구")
    assert result["source"] in ("llm", "fallback", "cache")
    assert result["answer"], "어떤 경우에도 문구는 비지 않는다"


def test_시스템프롬프트가_규칙을_담고_있다():
    prompt = dx.SYSTEM_PROMPT
    assert "get_dontworry_breakdown" in prompt
    assert "지어내" in prompt
    assert "2~3문장" in prompt
    assert "보험료" in prompt and "요율" in prompt


# ══════════════════════════════════════════════════════════════════════════
# 6. 엔드포인트
# ══════════════════════════════════════════════════════════════════════════
def test_엔드포인트가_문구와_근거를_함께_준다():
    body = client.post("/api/dontworry/explain", json={
        "user_id": "stu_1", "재수유형": "재종합학원",
        "sido": "서울", "gu": "강남구"}).json()

    assert body["answer"]
    assert body["source"] in ("llm", "fallback", "cache")
    assert body["breakdown"]["시도"] == "서울"
    assert body["breakdown"]["구"] == "강남구"
    assert body["breakdown"]["기준시점"]


def test_엔드포인트는_잘못된_재수유형을_알려준다():
    body = client.post("/api/dontworry/explain", json={
        "user_id": "stu_1", "재수유형": "없는유형"}).json()
    assert body["source"] == "error"
    assert "알 수 없는 재수유형" in body["error"]


def test_엔드포인트_지역없이도_동작한다():
    """DB 에 거주지가 없으면 전국 평균으로 답한다."""
    body = client.post("/api/dontworry/explain", json={
        "user_id": "stu_none", "재수유형": "기숙학원"}).json()
    assert body["answer"]
    assert body["breakdown"]["최종지역계수"] == 1.0


def test_엔드포인트가_표시비용과_같은_숫자를_설명한다():
    """설명의 최종금액이 돈워리 화면(/api/cost-estimate)의 총액과 일치해야 한다."""
    estimate = client.get("/api/cost-estimate", params={
        "form": "재수종합학원", "sido": "서울", "gu": "강남구"}).json()
    explain = client.post("/api/dontworry/explain", json={
        "user_id": "stu_1", "재수유형": "재종합학원",
        "sido": "서울", "gu": "강남구"}).json()

    assert explain["breakdown"]["최종예상비용_만원"] == estimate["total"], (
        "설명이 화면과 다른 금액을 말하면 신뢰를 잃는다")
    assert explain["breakdown"]["최종지역계수"] == pytest.approx(
        estimate["region_coefficient"]["coefficient"])


def test_설명은_보험료에_영향을_주지_않는다():
    import engine

    base = {"tier": "스탠다드", "household_income_manwon": 500,
            "academy_density_index": 3, "monthly_edu_cost_manwon": 60}
    before = engine.price(base)["monthly_premium"]
    client.post("/api/dontworry/explain", json={
        "user_id": "stu_1", "재수유형": "기숙학원", "sido": "서울", "gu": "강남구"})
    assert engine.price(base)["monthly_premium"] == before
