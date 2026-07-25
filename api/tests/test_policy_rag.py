"""약관 HTML RAG 회귀 테스트 — 조항 단위 파싱·앵커 출처·검색 품질."""
from __future__ import annotations

import pytest

import rag_light as R


# ══════════════════════════════════════════════════════════════════════════
# 문서 파싱
# ══════════════════════════════════════════════════════════════════════════
def test_약관_HTML을_읽는다():
    assert R.POLICY_PATH.endswith(".html")
    assert "재수없수_교육보험_보통약관_수정본" in R.POLICY_PATH


def test_조항_단위로_파싱된다():
    secs = R._document_sections()
    assert len(secs) >= 70                     # 제1~37조 + 특약 6 + 별표 7 + 상품설명서 13 …
    assert all(s["title"] for s in secs)
    assert all(s["anchor"] for s in secs)
    # 앵커는 문서 내에서 유일해야 한다 (근거 팝업이 앵커로 조항을 찾으므로)
    anchors = [s["anchor"] for s in secs]
    assert len(anchors) == len(set(anchors))
    # index 는 1부터 연속
    assert [s["index"] for s in secs] == list(range(1, len(secs) + 1))


@pytest.mark.parametrize("anchor,keyword", [
    ("제13조-보험금의-지급사유", "심각도"),
    ("제15조-보험금을-지급하지-않는-사유", "위·변조"),
    ("별표2-가입시점", "late"),
    ("별표3-성적-급락-판정", "1.75"),
    ("별표4-위험확률-및-보험료-산출", "1.8720%"),
    ("별표5-해약환급금", "환급률"),
    ("별표6-수능-응시과목-선언", "선언"),
    ("별표7-회차별-가중치", "0.6241"),
])
def test_핵심_조항이_앵커로_조회된다(anchor, keyword):
    secs = [s for s in R._document_sections() if s["anchor"].startswith(anchor)]
    assert secs, f"{anchor} 조항을 찾지 못함"
    got = R.section_text(secs[0]["anchor"])
    assert got["found"] is True
    # h4 소제목이 조항 본문을 갈라놓으므로 하위까지 합친 full_text 로 확인한다
    assert keyword in got["full_text"], f"{anchor} 조항 전문에 '{keyword}' 없음"


def test_표가_평문화된다():
    """별표2·3·4·6·7 은 표가 본문이다 — 행이 '| a | b |' 로 읽혀야 한다."""
    b4 = next(s for s in R._document_sections()
              if s["anchor"].startswith("별표4-위험확률-및-보험료-산출"))
    lines = [ln for ln in b4["text"].splitlines() if ln.startswith("|")]
    assert len(lines) >= 10
    # 게시 보험료표 행이 셀 단위로 정확히 잡혀야 한다
    assert any("스탠다드" in ln and "3,262원" in ln for ln in lines)
    assert any("프리미엄" in ln and "7,622원" in ln for ln in lines)


def test_별표7_회귀계수_9개가_모두_읽힌다():
    b7 = next(s for s in R._document_sections()
              if s["anchor"].startswith("별표7-회차별-가중치"))
    import engine
    for coef in engine.OLS_COEF.values():
        assert f"{abs(coef):.4f}" in b7["text"].replace("−", "-")


def test_없는_앵커는_found_False():
    got = R.section_text("존재하지-않는-앵커")
    assert got["found"] is False
    assert got["text"] == "" and got["full_text"] == ""


def test_조항을_열면_하위_소제목까지_합쳐_보여준다():
    """별표3 을 열면 판정 구간 표(−1.75σ/−2.25σ)까지 나와야 한다."""
    anchor = next(s["anchor"] for s in R._document_sections()
                  if s["anchor"].startswith("별표3-성적-급락-판정"))
    got = R.section_text(anchor)
    assert got["subsections"], "별표3 에 하위 소제목이 붙어 있어야 한다"
    assert "1.75" not in got["text"]          # 부모 본문만 보면 없다
    assert "1.75" in got["full_text"]         # 조항 전문에는 있다
    assert len(got["full_text"]) > len(got["text"])


def test_출처_제목이_부모_조항을_앞세운다():
    kids = [s for s in R._document_sections() if s.get("parent_title")]
    assert kids
    for s in kids:
        assert s["display_title"].startswith(s["parent_title"])
        assert " › " in s["display_title"]


def test_상품설명서_항목과_도입박스는_독립_조항이다():
    """'01계약자 배당'(상품설명서)·'🔑 …'(절 도입 박스)는 직전 조항의 하위가 아니다."""
    for sec in R._document_sections():
        if sec["title"][:2].isdigit() or sec["title"].startswith("🔑"):
            assert sec.get("parent_title") is None, sec["title"]


def test_목차():
    toc = R.section_list()
    assert len(toc) == len(R._document_sections())
    assert all({"anchor", "title", "index"} <= set(row) for row in toc)


# ══════════════════════════════════════════════════════════════════════════
# 청킹 · 색인
# ══════════════════════════════════════════════════════════════════════════
def test_청크는_조항_앵커와_제목을_유지한다():
    chunks = R._load_chunks()
    assert chunks
    valid = {s["anchor"] for s in R._document_sections()}
    for c in chunks:
        assert c["anchor"] in valid
        assert c["title"]
        assert len(c["text"]) <= R._MAX_CHUNK_CHARS + 1


def test_모든_조항이_최소_한_청크로_색인된다():
    covered = {c["anchor"] for c in R._load_chunks()}
    assert covered == {s["anchor"] for s in R._document_sections()}


# ══════════════════════════════════════════════════════════════════════════
# 토크나이저 — 한국어 조사 제거
# ══════════════════════════════════════════════════════════════════════════
def test_조사가_제거되어_어간이_생긴다():
    """'보험금은' 이 '보험금' 으로 정규화되지 않으면 본문과 매칭되지 않는다."""
    toks = {t for t, _ in R._tokenize("보험금은 언제 받나요")}
    assert "보험금" in toks
    toks2 = {t for t, _ in R._tokenize("청약철회를 하고싶어요")}
    assert "청약철회" in toks2


@pytest.mark.parametrize("word,stem", [
    ("보험금은", "보험금"), ("보험료가", "보험료"), ("약관에서", "약관"),
    ("보장을", "보장"), ("가입의", "가입"), ("환급률은", "환급률"),
])
def test_stem(word, stem):
    assert R._stem(word) == stem


def test_짧은_어절은_과하게_깎지_않는다():
    # 어간이 2자 미만으로 남으면 벗기지 않는다
    assert R._stem("의의") == "의의"
    assert R._stem("가가") == "가가"


def test_2gram은_어절보다_낮게_가중된다():
    weights = dict(R._tokenize("보험금"))
    assert weights["보험금"] == 1.0
    assert weights["보험"] == pytest.approx(R.BIGRAM_WEIGHT)


# ══════════════════════════════════════════════════════════════════════════
# 검색 품질
# ══════════════════════════════════════════════════════════════════════════
# (질문, 정답 앵커 접두사) — 실제 고객이 쓸 표현으로 구성
CASES = [
    ("보험금은 언제 어떻게 받나요?", "제14조"),
    ("보험금 청구는 어떻게 하나요?", "제14조"),
    ("보험금은 어떤 조건에서 받나요?", "제13조"),
    ("보장에서 제외되는 경우는 뭔가요?", "제15조"),
    ("청약철회는 어떻게 하나요?", "제5조"),
    ("급락 판정 기준이 뭐예요?", "별표3"),
    ("얼마나 성적이 떨어져야 보장돼요?", "별표3"),
    ("가입은 언제까지 할 수 있나요?", "제33조"),
    ("스탠다드 월 보험료가 얼마예요?", "별표4"),
    ("수능 응시과목은 언제 선언해요?", "별표6"),
    ("보험료는 무엇으로 구성되나요?", "03보험료"),
    ("성적이 오르면 보험료가 내려가나요?", "제26조"),
    ("이의신청은 어떻게 하나요?", "제30조"),
    ("모의고사를 못 봤으면 어떻게 되나요?", "제32조"),
    ("입학축하금은 뭐예요?", "특약-제2조"),
    ("해약환급금은 얼마나 되나요?", ("제9조", "별표5", "11해약환급금", "12해약환급금")),
    ("늦게 가입하면 보험료가 오르나요?", ("별표2", "제25조", "Δθ")),
    ("보험료가 갱신되면 얼마나 오를 수 있나요?", ("별표1", "제25조", "제29조", "13보험료")),
]


def _wants(want) -> tuple[str, ...]:
    return want if isinstance(want, tuple) else (want,)


@pytest.mark.parametrize("query,want", CASES, ids=[c[0][:24] for c in CASES])
def test_정답_조항이_상위_3위_안에_든다(query, want):
    hits = R.retrieve(query, k=3)
    assert hits, f"'{query}' 검색 결과 없음"
    anchors = [h["anchor"] for h in hits]
    assert any(a.startswith(w) for a in anchors for w in _wants(want)), \
        f"'{query}' → {[h['title'][:30] for h in hits]}"


def test_top1_정확도가_기준선_이상():
    """회귀 방지용 하한. 현재 14/18 이며 이보다 떨어지면 검색이 퇴행한 것이다."""
    hit = sum(
        1 for q, want in CASES
        if (h := R.retrieve(q, k=1)) and any(h[0]["anchor"].startswith(w) for w in _wants(want))
    )
    assert hit >= 12, f"top-1 정확도 {hit}/{len(CASES)}"


def test_검색결과에_조항명과_앵커가_담긴다():
    hits = R.retrieve("보험금 지급 사유", k=3)
    for h in hits:
        assert h["anchor"] and h["title"]
        assert h["score"] > 0
        assert "page" in h        # 하위 호환 필드


def test_같은_조항이_중복으로_나오지_않는다():
    hits = R.retrieve("보험료 산출 기준 티어별 월납 보장금", k=5)
    anchors = [h["anchor"] for h in hits]
    assert len(anchors) == len(set(anchors))


def test_출처_포맷에_페이지번호가_없다():
    hits = R.retrieve("청약철회", k=2)
    formatted = R._format_docs(hits)
    assert "p." not in formatted
    assert "출처: 약관" in formatted


def test_별칭이_어휘_불일치를_보강한다():
    """제15조 제목은 '지급하지 않는 사유'라 '면책/제외'로는 안 잡힌다 — 별칭으로 보강."""
    assert any("면책" in v for v in R.SECTION_ALIASES.values())
    for anchor_prefix in R.SECTION_ALIASES:
        assert any(s["anchor"].startswith(anchor_prefix) for s in R._document_sections()), \
            f"별칭 키 '{anchor_prefix}' 에 대응하는 조항이 없음 (앵커가 바뀌었을 수 있다)"


# ══════════════════════════════════════════════════════════════════════════
# 프론트엔드가 하드코딩한 앵커 — 약관 id 가 바뀌면 링크가 조용히 깨진다
# ══════════════════════════════════════════════════════════════════════════
# web/src/App.jsx 의 POLICY_ANCHORS · app 의 근거 링크와 동일하게 유지해야 한다.
FRONTEND_ANCHORS = [
    "제5조-청약의-철회",
    "제15조-보험금을-지급하지-않는-사유",
    "별표2-가입시점-선택-로딩-late-및-납입-구조-제11조-제22조-연계",
    "별표3-성적-급락-판정-기준-제13조-제26조-연계",
    "별표4-위험확률-및-보험료-산출-기준-제22조-제24조-연계",
    "별표5-해약환급금-환급률-제9조-연계",
]


@pytest.mark.parametrize("anchor", FRONTEND_ANCHORS)
def test_프론트가_링크하는_앵커가_실제로_존재한다(anchor):
    got = R.section_text(anchor)
    assert got["found"] is True, (
        f"앵커 '{anchor}' 가 약관에 없습니다. 약관 HTML 의 id 가 바뀌었다면 "
        f"web/src/App.jsx 의 POLICY_ANCHORS 와 이 목록을 함께 고쳐야 합니다."
    )
