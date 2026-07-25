"""경량 RAG 엔진 — 실제 약관 문서 기반 다중 LLM 질의응답.

원본 terms_reader_agent.py 는 Gemini + 로컬 임베딩(sentence-transformers) + chromadb 를 쓰지만,
번들이 무겁고 배포/검증이 어렵다. 이 모듈은 동일한 목적을 가볍게 재구성한다.

  · 검색(retrieval): PDF/Markdown 약관을 읽어 청킹 → 순수 파이썬 TF-IDF (임베딩 API·torch 불필요)
  · 생성(generation): .env 의 LLM_PROVIDER/모델 설정을 사용 (현재 기본 OpenAI gpt-4o)
  · 폴백: 사용 가능한 LLM 키가 없으면 검색된 약관 발췌를 그대로 정리해 답변

인터페이스(answer_question)만 고정돼 있어, 나중에 벡터 검색으로 교체해도 호출부는 그대로다.
"""
from __future__ import annotations

import math
import os
import re
from functools import lru_cache

from dotenv import load_dotenv

# override=True: .env 수정이 항상 반영되도록(uvicorn --reload 로 재기동 없이 편집해도 새 값 적용).
load_dotenv(override=True)

# LangSmith 추적 — 미설치 환경에서도 앱이 죽지 않도록 no-op 폴백을 둔다.
# (.env 의 LANGSMITH_TRACING=true + LANGSMITH_API_KEY 가 있으면 자동 전송)
try:
    from langsmith import get_current_run_tree, traceable
    from langsmith.wrappers import wrap_anthropic
except ImportError:  # noqa: BLE001
    def traceable(*args, **kwargs):
        if len(args) == 1 and callable(args[0]) and not kwargs:
            return args[0]
        return lambda fn: fn

    def wrap_anthropic(client):
        return client

    def get_current_run_tree():
        return None

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "auto").strip().lower()
LLM_MODEL = os.getenv("LLM_MODEL", "").strip()


def _configured_model(provider: str, env_name: str, default: str) -> str:
    """명시적으로 선택한 provider에는 공통 LLM_MODEL을 우선 적용한다."""
    if LLM_PROVIDER == provider and LLM_MODEL:
        return LLM_MODEL
    return os.getenv(env_name, default)


LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or ""
ANTHROPIC_MODEL = _configured_model("anthropic", "ANTHROPIC_MODEL", "claude-opus-4-8")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = _configured_model("openai", "OPENAI_MODEL", "gpt-4o")

# DeepSeek·Grok 은 OpenAI 호환 API 라 엔드포인트·모델명만 다르고 요청 형식은 같다.
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = _configured_model("deepseek", "DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

GROK_API_KEY = os.getenv("GROK_API_KEY") or os.getenv("XAI_API_KEY") or ""
GROK_MODEL = _configured_model("grok", "GROK_MODEL", "grok-3")
GROK_BASE_URL = os.getenv("GROK_BASE_URL", "https://api.x.ai")

# Gemini 도 OpenAI 호환 엔드포인트를 제공한다(/v1beta/openai). 무료 티어가 있다.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
GEMINI_MODEL = _configured_model("gemini", "GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")

# 어느 회사로 답할지: openai | anthropic | deepseek | grok | gemini
# auto(기본)면 키가 있는 것 중 _PROVIDER_ORDER 순서로 고른다.

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_POLICY_DOCUMENT = "재수없수_교육보험_보통약관.md"
_configured_policy_path = (
    os.getenv("POLICY_DOCUMENT")
    or os.getenv("POLICY_PDF")  # 기존 설정과의 하위 호환
    or _DEFAULT_POLICY_DOCUMENT
)
POLICY_PATH = (
    _configured_policy_path
    if os.path.isabs(_configured_policy_path)
    else os.path.join(_BASE_DIR, _configured_policy_path)
)

# 원본 terms_reader_agent.py 의 컴플라이언스 페르소나 프롬프트 (그대로 재사용)
SYSTEM_PROMPT = """당신은 보험사의 "AI 보험 안내 도우미"입니다. 고객에게 보험 약관과 보험료 산정근거를
쉽고 친절하게, 그리고 근거에 충실하게 설명하는 역할입니다.

━━━━━━━━━━━━━━━━━━━━
[입력 형식]
매 질문마다 검색된 근거 문서가 아래 형태로 함께 주어집니다.
각 조각(chunk)에는 출처 식별자(예: [문서2 · 제12조])가 붙어 있습니다.

<참고 문서>
{context}
</참고 문서>

<질문>
{question}
</질문>

━━━━━━━━━━━━━━━━━━━━
[근거 활용 규칙 — RAG 정확도의 핵심]
① 관련성 판별: 주어진 조각 중 질문과 실제로 관련된 것만 근거로 쓰세요.
   상위에 검색됐더라도 무관한 조각은 무시하고 답에 끌어오지 마세요.
② 충분성 판단: 답하기 전에 "이 문서만으로 답할 수 있는가"를 먼저 점검하세요.
   - 전부 답 가능 → 답합니다. ★ 본문에 [약관 p.7 · 제26조] 같은 인라인 출처 표기는 넣지 마세요.
     출처(근거 약관 페이지·조항)는 화면 하단에 자동으로 따로 표시되니 문장 안에서는 생략합니다.
   - 일부만 가능 → 가능한 부분만 답하고, 나머지는
     "제공된 문서에서 ○○ 부분은 확인할 수 없습니다"라고 명시합니다.
   - 관련 근거 없음 → "제공된 약관/기준 문서에서 해당 내용을 확인할 수 없습니다"라고만
     답하고, 외부 지식·일반 상식으로 메우지 마세요.
③ 원문 인용 우선: 숫자(요율·금액·기간·나이)와 조건은 문서에 적힌 값을 그대로 옮기고,
   임의 계산·합산·추정·반올림을 하지 마세요. (출처 조항 표기는 ②대로 본문에 넣지 않습니다.)
④ 상충 처리: 두 조각의 내용이 다르면 임의로 하나를 고르지 말고,
   "문서에 따라 ○○과 △△로 다르게 기재되어 있어 확인이 필요합니다"라고 함께 안내합니다.
⑤ 질문 분해: 여러 조건이 얽힌 질문은 조건별로 나눠, 각 조건의 근거를 짚어 답합니다.
⑥ 사실/안내 구분: 문서에서 직접 확인된 사실과 그로부터 이어지는 일반 안내를 구분하고,
   확인되지 않은 것을 확인된 것처럼 단정하지 마세요.

━━━━━━━━━━━━━━━━━━━━
[컴플라이언스 규칙]
1. 위 [근거 활용 규칙]에 따라 문서 근거로만 답합니다.
2. 가입을 단정적으로 권유하거나 "무조건 유리하다/이득이다" 같은 표현을 쓰지 마세요.
   당신은 안내자이지 판매자가 아닙니다.
3. 보험금 지급 여부·최종 보험료·심사 결과는 단언하지 말고,
   "약관 기준상 ~에 해당할 수 있으며, 실제 지급/인수 여부는 회사 심사에 따라 달라집니다"처럼 안내합니다.
4. 문서에 없는 수치·조건을 만들어내지 마세요(③과 동일).
5. 공개하지 않는 사항은 다음과 같습니다.
   - 사업비 계수 (안전할증·정액운영비·제휴수수료·변동비 등의 값)
   - 급락 임계 σ·z 값, 확정 요율 공식·계수(θ, F, c, v 등),
     스코어카드 원점수·로짓 계수(예: +0.35 같은 요인별 기여 점수)
   - ★ 모든 확률값: 개인 재수확률(R_i), 경증/중증 사고확률, 급락확률 등.
     "0.32", "0.53%", "평균 0.27" 같은 수치는 물론이고 "재수확률", "사고확률" 같은
     확률 지표의 이름 자체도 답변에 등장시키지 마세요.
   - x, y, z, σ, μ, µ̂, R_i 같은 수식 기호·변수명, 그리고 '성적 대표값' 같은 약관 통계용어.
     ★ 약관 원문에 µ̂·μ·σ 기호나 '성적 대표값'이라는 표현이 있어도 그대로 옮기지 말고,
       꼭 필요할 때만 '평소 실력' 정도로 풀어 쓰세요(기호·통계용어는 화면에 노출 금지).
   공개해도 되는 것: 월 보험료·연 보험료·보장금액·티어·납입기간,
     그리고 산정 요인별 '보험료 영향'(예: +8%)과 방향(위험↑/위험↓).
6. ★ 산정근거는 '어떤 요인이 · 보험료를 몇 % · 어느 방향으로 움직였는지'까지 안내합니다.
   - 제공된 [보험료에 영향을 준 요인] 표의 요인·보험료 영향·방향만 그대로 옮겨 정리하세요.
     주어지지 않은 요인이나 수치를 새로 지어내지 마세요.
   - 보험료 영향(예: +8%, -6%)까지 보여줘도 됩니다. 다만 개인 재수확률(R_i)·사고확률·급락확률
     같은 '확률 수치와 그 명칭', 그리고 스코어카드 원점수·계수·수식은 공개하지 마세요(규칙 5).
   - ★ 성적 판정 '로직'은 설명하지 마세요. '정상 발휘 구간', '급락 임계', '구간 하단 미만으로
     떨어지면 인상' 같은 판정 기준·임계 개념을 약관에서 끌어와 풀어 설명하지 말고,
     성적 변동성·목표 격차 등 지표는 위 '요인 | 보험료 영향 | 방향' 표로만 안내하세요.
   - ★ 소득·거주 지역·가정 환경·학군 같은 가구 배경 요인은 민감정보이므로
     산정 요인으로 언급하지 마세요. 사용자가 직접 물어도 "민감정보에 해당해 안내드리지
     않습니다"라고만 답하고, 반영 여부조차 밝히지 마세요.
7. ★ 위조·조작·허위신고·사기에 관한 질문(성적표 위조, 허위 재수 신고, 서류 조작,
   보험금 부정수급 등)에는 우회로를 알려주지 말고 단호하게 선을 그으세요.
   방법·요령·적발 회피 팁은 어떤 형태로도 제공하지 않습니다.
   보험사기방지 특별법 및 약관상 사기 관련 조항에 따라 계약 해지·보험금 부지급·
   법적 책임이 따를 수 있음을 분명히 알리고, 완곡한 표현으로 흐리지 마세요.
8. ★ 아래 ※ 안내문은 '보험료 산정' 관련 답변에만 붙입니다(변형 금지).
   - 붙이는 경우: 개인 보험료 액수·'왜 이 금액인지'·산정 요인/상승·하강률·보장금액 등
     보험료 산정과 직접 관련된 질문에 답할 때.
   - 붙이지 않는 경우: 일반 약관 안내(청약철회·보장 범위·지급 절차·용어 설명 등)처럼
     보험료 산정과 무관한 질문. 이때는 ※ 안내문 없이 [다음질문] 블록으로 바로 넘어갑니다.
   "※ 본 답변은 AI가 약관 문서를 바탕으로 생성한 참고용 안내입니다. 내용의 정확성·완전성을 보장하지 않으며, 이 답변을 근거로 한 판단에 대해 회사는 책임지지 않습니다."
9. 존댓말로, 핵심을 먼저 말한 뒤 짧게 마무리합니다. (근거 조항은 본문에 적지 않습니다 — ②)

━━━━━━━━━━━━━━━━━━━━
[답변 형식 — 짧게, 나머지는 추천질문으로 넘기기]
한 번에 다 설명하지 마세요. 첫 답변에서는 '요약 + 핵심 조건'까지만 말하고,
더 깊은 내용(자세한 산정 방식, 예외 조항, 절차 상세 등)은 [다음질문] 블록으로 넘깁니다.

- 본문은 ※ 안내문과 [다음질문] 블록을 빼고 5줄 이내를 기준으로 합니다. 짧을수록 좋습니다.
- 기본 뼈대는 '한 줄 요약 + (필요하면) 표 하나'. 이 이상 늘리지 마세요.
  ★ 첫 답변에는 💡 팁·해석 문장을 붙이지 마세요. 요약과 표까지만 보여주고 끝냅니다.
  판정 원칙·약관 구간 설명 같은 문단도 만들지 말고, 팁·더 깊은 내용은 [다음질문]으로 넘깁니다.
- 맨 처음은 '한 줄 요약'으로 시작. (예: "✅ 핵심부터 말씀드리면, ...")
- 이모지는 절제해서. (✅ 요약 · 📌 조건 · ⚠️ 주의)
- 어려운 용어는 괄호로 짧게 풀어 설명.

★ 표 사용 규칙
- 두 개 이상의 항목·조건·금액을 나열할 때는 문장 대신 마크다운 표로 정리합니다.
- 표는 기본 2열로 만드세요. 3열 이상은 화면이 가로로 밀려 읽을 수 없습니다.
  좌열은 항목명, 우열은 값. 값은 20자 이내로 줄여 쓰세요.
  · 예외: 보험료 산정요인 표는 '요인 | 보험료 영향 | 방향' 3열까지 허용됩니다.
    (보험료 영향은 +8% 처럼 부호·% 포함, 방향은 위험↑ / 위험↓. 이 표에만 적용)
- '확인 여부', '문서상 확인 내용', '해당 여부', '비고' 같은 메타 열은 만들지 마세요.
  확인되지 않은 항목은 표에 넣지 말고 표 밖에 한 문장으로 적습니다.
- 표 형식은 정확히 아래처럼 (헤더 줄 + 구분선 줄 + 데이터 줄):
  | 항목 | 값 |
  | --- | --- |
  | 월 보험료 | 4,421원 |
  | 연 최대 보장 | 840만원 |
- ★ 첫 답변에서는 표 아래 해석·팁 문장을 붙이지 말고 표로 끝냅니다. (해석이 필요하면 [다음질문]으로)
  표에 있는 값을 문장으로 다시 읊지 마세요.

★ 문체 금지 사항
- 굵게(**), 기울임(*) 등 강조 문법을 쓰지 마세요. 강조가 필요하면 표로 분리합니다.
- 같은 내용을 요약·표·해설에서 반복하지 마세요. 한 번만 말합니다.
- 다음 표현은 쓰지 마세요: "참고로", "솔직하게 한 말씀 덧붙이자면", "말씀드리자면",
  "덧붙이자면", "개인적으로는", "~하시길 권해 드립니다" 같은 참견·훈수성 문구.
  묻지 않은 조언을 붙이지 말고, 물어본 것에만 답하세요.
- 조항 제목만 검색된 경우 길게 설명하지 말고
  "해당 내용은 제공된 문서에서 확인할 수 없습니다" 한 줄로 끝냅니다.
- 이전 답변에 없던 내용을 새로 물었다고 해서 "오타/실수가 있었다"고 지어내 정정·사과하지 마세요.
  앞 답변이 좁게 나온 건 질문 범위가 좁았기 때문이니, 담담하게 이번 질문에 맞게 새로 안내하면 됩니다.

★ [다음질문] 블록 — 매 답변 맨 끝에 반드시 붙입니다
- ※ 안내문이 있으면 그 다음 줄에, 없으면(=보험료 산정과 무관한 답변) 본문 다음 줄에 바로 출력합니다.
- 고객이 바로 누를 수 있게 고객의 말투("~가 궁금해요!", "~는 어떻게 되나요?")로 씁니다.
- 이번 답변에서 일부러 줄인 내용을 1순위로 넣으세요.
- 2~3개, 각 20자 이내. 이미 답한 내용은 다시 넣지 마세요.

  [다음질문]
  - 보험료는 어떻게 정해지나요?
  - 보장 제외 사유가 궁금해요!

- 전체 예시:
  ✅ (한 줄 요약)

  | 항목 | 값 |
  | --- | --- |
  | (항목1) | (값1) |
  | (항목2) | (값2) |

  ※ 본 답변은 AI가 ...

  [다음질문]
  - (추천 질문1)
  - (추천 질문2)"""

_STOP = {"그리고", "그러나", "합니다", "입니다", "있습니다", "대한", "위한", "경우", "이다", "하는", "되는", "및", "등"}


def _tokenize(text: str) -> list[str]:
    clean = re.sub(r"[^0-9a-z가-힣\s]", " ", (text or "").lower())
    words = [w for w in clean.split() if len(w) >= 2 and w not in _STOP]
    grams: list[str] = []
    for w in words:
        grams.append(w)
        if re.search(r"[가-힣]", w) and len(w) >= 3:  # 한글 2-gram 으로 부분 매칭 강화
            grams += [w[i:i + 2] for i in range(len(w) - 1)]
    return grams


# 브라우저 인쇄본 PDF의 머리말/꼬리말 노이즈 (약관 내용 아님)
_NOISE = re.compile(
    r"(^\s*\d+\.\s*\d+\.\s*\d+\.\s*(오전|오후).*$)"      # "26. 7. 20. 오후 5:39 ..."
    r"|(^\s*file:///.*$)"                                  # "file:///C:/.../....html 2/14"
    r"|(^\s*재수없수\s*!\s*—.*통합판.*$)"                  # 페이지 상단 반복 제목
    r"|(^\s*\d+\s*/\s*14\s*$)",                            # "2/14" 페이지 번호
    re.MULTILINE,
)


def _clean(text: str) -> str:
    text = _NOISE.sub("", text.replace("\r", ""))
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _plain_title(text: str) -> str:
    """Markdown/HTML 표시 문법을 걷어 근거 팝업용 제목으로 정리한다."""
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    first_line = re.sub(r"^#{1,6}\s*", "", first_line)
    first_line = re.sub(r"<[^>]+>", " ", first_line)
    first_line = re.sub(r"[*_`]", "", first_line)
    return re.sub(r"\s+", " ", first_line).strip()[:80]


def _split_long_markdown_section(section: str, max_chars: int = 5000) -> list[str]:
    """긴 Markdown 섹션을 문단/줄 경계에서 논리 페이지로 나눈다."""
    pages: list[str] = []
    current: list[str] = []
    current_len = 0

    def flush() -> None:
        nonlocal current, current_len
        if current:
            pages.append("\n\n".join(current).strip())
            current = []
            current_len = 0

    for block in re.split(r"\n\s*\n", section):
        block = block.strip()
        if not block:
            continue

        # HTML 표처럼 빈 줄 없이 매우 긴 블록은 줄 경계에서 먼저 잘라 둔다.
        pieces: list[str] = []
        piece_lines: list[str] = []
        piece_len = 0
        for line in block.splitlines():
            if piece_lines and piece_len + len(line) + 1 > max_chars:
                pieces.append("\n".join(piece_lines))
                piece_lines = []
                piece_len = 0
            if len(line) > max_chars:
                if piece_lines:
                    pieces.append("\n".join(piece_lines))
                    piece_lines = []
                    piece_len = 0
                pieces.extend(line[i:i + max_chars] for i in range(0, len(line), max_chars))
            else:
                piece_lines.append(line)
                piece_len += len(line) + 1
        if piece_lines:
            pieces.append("\n".join(piece_lines))

        for piece in pieces:
            if current and current_len + len(piece) + 2 > max_chars:
                flush()
            current.append(piece)
            current_len += len(piece) + 2
    flush()
    return pages


@lru_cache(maxsize=1)
def _document_pages() -> dict[int, dict[str, str]]:
    """PDF의 실제 페이지 또는 Markdown의 제목별 논리 페이지를 읽는다."""
    if not os.path.exists(POLICY_PATH):
        raise FileNotFoundError(f"약관 문서를 찾을 수 없습니다: {POLICY_PATH}")

    extension = os.path.splitext(POLICY_PATH)[1].lower()
    pages: dict[int, dict[str, str]] = {}

    if extension == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(POLICY_PATH)
        for pageno, page in enumerate(reader.pages, start=1):
            text = _clean(page.extract_text() or "")
            pages[pageno] = {"title": _plain_title(text), "text": text}
        return pages

    if extension not in {".md", ".markdown", ".txt"}:
        raise ValueError(f"지원하지 않는 약관 문서 형식입니다: {extension}")

    with open(POLICY_PATH, encoding="utf-8") as policy_file:
        text = _clean(policy_file.read())

    # Markdown 제목을 페이지 경계로 삼되, 너무 긴 섹션은 근거 팝업과 검색에
    # 부담이 되지 않도록 약 5,000자 단위의 논리 페이지로 추가 분할한다.
    sections = re.split(r"(?=^#{1,6}\s+)", text, flags=re.MULTILINE)
    pageno = 1
    for section in sections:
        section = section.strip()
        if not section:
            continue
        section_title = _plain_title(section)
        for logical_page in _split_long_markdown_section(section):
            pages[pageno] = {"title": section_title, "text": logical_page}
            pageno += 1
    return pages


def _load_chunks() -> list[dict]:
    """약관 문서 → 페이지별 텍스트 → 조(제N조)/문단 단위 청킹."""
    chunks: list[dict] = []
    for pageno, page in _document_pages().items():
        text = page["text"]
        if not text:
            continue
        # Markdown 제목, '제N조' 경계 또는 빈 줄로 분할
        parts = re.split(
            r"(?=^#{1,6}\s+)|(?=^(?:특약\s+)?제\s*\d+\s*조)|\n\s*\n",
            text,
            flags=re.MULTILINE,
        )
        for part in parts:
            part = part.strip()
            if len(part) < 30:
                # 짧은 조각은 직전 청크에 붙여 문맥 유지
                if chunks and chunks[-1]["page"] == pageno:
                    chunks[-1]["text"] += "\n" + part
                continue
            m = (
                re.match(r"(?:#{1,6}\s*)?((?:특약\s+)?제\s*\d+\s*조\s*\([^)]*\))", part)
                or re.match(r"(?:#{1,6}\s*)?((?:특약\s+)?제\s*\d+\s*조)", part)
            )
            title = re.sub(r"\s+", " ", m.group(1)).strip() if m else page["title"]
            chunks.append({"page": pageno, "title": title, "text": part})
    return chunks


@lru_cache(maxsize=1)
def _index():
    """청크 + DF(문서빈도) 색인 (최초 1회 구축, 캐시)."""
    chunks = _load_chunks()
    df: dict[str, int] = {}
    for c in chunks:
        toks = _tokenize(c["text"])
        tf: dict[str, int] = {}
        for t in toks:
            tf[t] = tf.get(t, 0) + 1
        c["tf"] = tf
        c["len"] = max(len(toks), 1)
        for t in tf:
            df[t] = df.get(t, 0) + 1
    n = max(len(chunks), 1)
    return {"chunks": chunks, "df": df, "n": n}


def retrieve(query: str, k: int = 5) -> list[dict]:
    """TF-IDF 코사인 유사도 상위 k 청크."""
    idx = _index()
    if not idx["chunks"]:
        return []
    qtf: dict[str, int] = {}
    for t in _tokenize(query):
        qtf[t] = qtf.get(t, 0) + 1

    def idf(t: str) -> float:
        return math.log((idx["n"] + 1) / (idx["df"].get(t, 0) + 1)) + 1

    scored = []
    for c in idx["chunks"]:
        dot = 0.0
        for t, qf in qtf.items():
            cf = c["tf"].get(t)
            if cf:
                dot += (qf * idf(t)) * (cf / c["len"] * idf(t))
        if dot > 0:
            scored.append((dot, c))
    scored.sort(key=lambda x: -x[0])
    return [
        {"page": c["page"], "title": c["title"], "text": c["text"], "score": round(s, 3)}
        for s, c in scored[:k]
    ]


@lru_cache(maxsize=1)
def _page_texts() -> dict:
    """문서 페이지별 전체 텍스트(정제본). 근거 팝업용."""
    return {pageno: page["text"] for pageno, page in _document_pages().items()}


def page_text(pageno: int) -> dict:
    """지정 페이지의 조항 제목 추정 + 전문 반환."""
    page = _document_pages().get(int(pageno), {})
    txt = page.get("text", "")
    titles = re.findall(r"제\s*\d+\s*조\s*\([^)]*\)", txt)
    title = (
        re.sub(r"\s+", " ", titles[0]).strip()
        if titles
        else page.get("title", "")
    )
    return {"page": int(pageno), "title": title, "text": txt}


def _format_docs(hits: list[dict]) -> str:
    return "\n\n---\n\n".join(f"[출처: 약관 / p.{h['page']} / {h['title']}]\n{h['text']}" for h in hits)


def _anthropic_enabled() -> bool:
    return bool(LLM_API_KEY and LLM_API_KEY.startswith("sk-ant-"))


def _openai_enabled() -> bool:
    return bool(OPENAI_API_KEY and OPENAI_API_KEY.startswith("sk-"))


def _deepseek_enabled() -> bool:
    return bool(DEEPSEEK_API_KEY and DEEPSEEK_API_KEY.startswith("sk-"))


def _grok_enabled() -> bool:
    return bool(GROK_API_KEY and GROK_API_KEY.startswith("xai-"))


def _gemini_enabled() -> bool:
    # Google AI Studio 키는 AIza… 와 AQ.… 두 형식이 모두 발급되므로 접두사로 거르지 않는다.
    return bool(GEMINI_API_KEY)


_PROVIDER_ORDER = ("openai", "anthropic", "deepseek", "grok", "gemini")
_PROVIDER_CHECKS = {
    "openai": _openai_enabled,
    "anthropic": _anthropic_enabled,
    "deepseek": _deepseek_enabled,
    "grok": _grok_enabled,
    "gemini": _gemini_enabled,
}


def available_providers() -> list[str]:
    """키가 채워져 실제로 호출 가능한 프로바이더 목록."""
    return [p for p in _PROVIDER_ORDER if _PROVIDER_CHECKS[p]()]


def pick_provider() -> str | None:
    """LLM_PROVIDER 가 지정돼 있으면 그것을, auto 면 가능한 것 중 첫 번째를 쓴다.
       지정한 프로바이더의 키가 없으면 None → 약관 발췌 폴백으로 넘어간다."""
    avail = available_providers()
    if LLM_PROVIDER in _PROVIDER_ORDER:
        return LLM_PROVIDER if LLM_PROVIDER in avail else None
    return avail[0] if avail else None


def selected_model_type(provider: str | None = None) -> str:
    """현재 선택된 프로바이더와 실제 모델명을 트레이스 입력용 문자열로 반환."""
    provider = provider or pick_provider()
    models = {
        "anthropic": ANTHROPIC_MODEL,
        "openai": OPENAI_MODEL,
        "deepseek": DEEPSEEK_MODEL,
        "grok": GROK_MODEL,
        "gemini": GEMINI_MODEL,
    }
    model = models.get(provider or "")
    return f"{provider}:{model}" if provider and model else "fallback:no-llm"


def _llm_enabled() -> bool:
    return pick_provider() is not None


def _user_content(query: str, hits: list[dict], student_context: str = "") -> str:
    ctx = f"{student_context}\n" if student_context else ""
    return f"[참고 문서]\n{_format_docs(hits)}\n{ctx}\n[고객 질문]\n{query}"


def _history_msgs(history: list[dict]) -> list[dict]:
    return [
        {"role": m["role"], "content": m["content"]}
        for m in (history or [])[-6:]
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]


def _ipv4_httpx():
    """httpx 클라이언트를 IPv4 로 강제 (일부 환경에서 IPv6 로 붙으려다 멈추는 문제 회피)."""
    import httpx

    return httpx.Client(
        transport=httpx.HTTPTransport(local_address="0.0.0.0", retries=1),
        timeout=httpx.Timeout(45.0, connect=8.0),
    )


def _generate_claude(query: str, hits: list[dict], history: list[dict], student_context: str = "") -> str:
    import anthropic

    # wrap_anthropic: messages.create 호출을 LangSmith 트레이스로 기록(토큰 사용량 포함).
    client = wrap_anthropic(anthropic.Anthropic(api_key=LLM_API_KEY, max_retries=1, http_client=_ipv4_httpx()))
    messages = _history_msgs(history) + [{"role": "user", "content": _user_content(query, hits, student_context)}]
    resp = client.messages.create(
        model=ANTHROPIC_MODEL, max_tokens=1200, system=SYSTEM_PROMPT, messages=messages,
    )
    return "".join(b.text for b in resp.content if b.type == "text").strip()


def _langsmith_llm_inputs(inputs: dict) -> dict:
    """LangSmith에는 API 키·URL을 제외한 OpenAI 메시지 형식만 기록한다."""
    return {
        "messages": inputs.get("messages", []),
        "model": inputs.get("model", ""),
    }


def _langsmith_llm_outputs(output: dict) -> dict:
    """LLM 출력은 LangSmith가 인식하는 OpenAI Chat Completions 형식으로 기록한다."""
    return {"choices": output.get("choices", [])} if isinstance(output, dict) else {}


def _langsmith_usage_metadata(usage: dict | None) -> dict:
    """OpenAI 호환 usage 응답을 LangSmith 표준 토큰 필드로 변환한다."""
    if not isinstance(usage, dict):
        return {}

    metadata: dict = {}
    field_map = {
        "prompt_tokens": "input_tokens",
        "completion_tokens": "output_tokens",
        "total_tokens": "total_tokens",
    }
    for source, target in field_map.items():
        value = usage.get(source)
        if isinstance(value, int):
            metadata[target] = value

    prompt_details = usage.get("prompt_tokens_details")
    if isinstance(prompt_details, dict):
        input_details = {}
        if isinstance(prompt_details.get("cached_tokens"), int):
            input_details["cache_read"] = prompt_details["cached_tokens"]
        if isinstance(prompt_details.get("audio_tokens"), int):
            input_details["audio"] = prompt_details["audio_tokens"]
        if input_details:
            metadata["input_token_details"] = input_details

    completion_details = usage.get("completion_tokens_details")
    if isinstance(completion_details, dict):
        output_details = {}
        if isinstance(completion_details.get("reasoning_tokens"), int):
            output_details["reasoning"] = completion_details["reasoning_tokens"]
        if isinstance(completion_details.get("audio_tokens"), int):
            output_details["audio"] = completion_details["audio_tokens"]
        if output_details:
            metadata["output_token_details"] = output_details

    return metadata


@traceable(
    run_type="llm",
    name="openai_compatible_chat",
    process_inputs=_langsmith_llm_inputs,
    process_outputs=_langsmith_llm_outputs,
)
def _post_chat_completion(
    url: str,
    api_key: str,
    provider: str,
    model: str,
    messages: list[dict],
) -> dict:
    """OpenAI 호환 호출을 실행하고 모델·토큰 정보를 LangSmith LLM span에 기록한다."""
    import httpx

    run = get_current_run_tree()
    if run is not None:
        run.set(
            metadata={
                "ls_provider": provider,
                "ls_model_name": model,
                "ls_temperature": 0.1,
                "ls_max_tokens": 1200,
            }
        )

    r = httpx.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model, "max_tokens": 1200, "temperature": 0.1, "messages": messages},
        timeout=httpx.Timeout(60.0, connect=8.0),
    )
    r.raise_for_status()
    payload = r.json()

    if run is not None:
        usage_metadata = _langsmith_usage_metadata(payload.get("usage"))
        if usage_metadata:
            run.set(usage_metadata=usage_metadata)

    return payload


def _generate_openai_compatible(url: str, api_key: str, model: str, query: str, hits: list[dict],
                                history: list[dict], student_context: str = "",
                                provider: str = "openai") -> str:
    """OpenAI /chat/completions 규격을 그대로 쓰는 API 공용 호출부 (OpenAI·DeepSeek).
       openai SDK 가 이 환경에서 멈추는 문제가 있어 원시 httpx 로 직접 호출한다(검증됨)."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += _history_msgs(history)
    messages.append({"role": "user", "content": _user_content(query, hits, student_context)})
    payload = _post_chat_completion(url, api_key, provider, model, messages)
    return (payload["choices"][0]["message"]["content"] or "").strip()


def _generate(query: str, hits: list[dict], history: list[dict], student_context: str = "") -> tuple[str, str]:
    """(답변, 사용한 provider)."""
    provider = pick_provider()
    if provider == "anthropic":
        return _generate_claude(query, hits, history, student_context), "anthropic"
    if provider == "deepseek":
        answer = _generate_openai_compatible(
            f"{DEEPSEEK_BASE_URL.rstrip('/')}/v1/chat/completions",
            DEEPSEEK_API_KEY, DEEPSEEK_MODEL, query, hits, history, student_context,
            provider="deepseek",
        )
        return answer, "deepseek"
    if provider == "grok":
        answer = _generate_openai_compatible(
            f"{GROK_BASE_URL.rstrip('/')}/v1/chat/completions",
            GROK_API_KEY, GROK_MODEL, query, hits, history, student_context,
            provider="xai",
        )
        return answer, "grok"
    if provider == "gemini":
        # GEMINI_BASE_URL 에 이미 /v1beta/openai 가 들어 있어 버전 경로를 덧붙이지 않는다.
        answer = _generate_openai_compatible(
            f"{GEMINI_BASE_URL.rstrip('/')}/chat/completions",
            GEMINI_API_KEY, GEMINI_MODEL, query, hits, history, student_context,
            provider="google",
        )
        return answer, "gemini"
    answer = _generate_openai_compatible(
        "https://api.openai.com/v1/chat/completions",
        OPENAI_API_KEY, OPENAI_MODEL, query, hits, history, student_context,
    )
    return answer, "openai"


# 프롬프트로 금지해도 모델이 가끔 흘리는 표현·문법을 답변 단계에서 확정적으로 제거한다.
# (프로바이더를 바꿔도 규칙이 유지되도록 하는 안전장치)
_SCRUB_PATTERNS = [
    (re.compile(r"\*\*(.+?)\*\*", re.S), r"\1"),          # 굵게 강조 해제
    (re.compile(r"(?<![\w가-힣])\*(?=\S)(.+?)(?<=\S)\*(?![\w가-힣])", re.S), r"\1"),  # 기울임 해제
    (re.compile(r"솔직하게\s*한\s*말씀\s*덧붙이자면[,\s]*"), ""),
    (re.compile(r"(?:덧붙이자면|말씀드리자면|개인적으로는)[,\s]*"), ""),
    (re.compile(r"참고로[,\s]+"), ""),
    # 약관 원문의 µ̂·μ(성적 대표값 기호)가 답변에 새어 나오면 강제로 지운다.
    # 뮤 문자(µ U+00B5 / μ U+03BC) + 뒤따르는 결합 강세부호(^ 등)를 함께 제거.
    (re.compile(r"[µμ][̀-ͯ]*"), ""),
    # '성적 대표값'이라는 약관 통계용어도 '평소 실력'으로 치환(µ̂ 없이 단어만 나올 때 대비).
    (re.compile(r"성적\s*대표값"), "평소 실력"),
    # 본문 인라인 출처 표기 [약관 p.7 · 제26조] / [문서2 · 제12조] 제거(출처는 하단에 따로 표시).
    # 단, [다음질문] 블록은 건드리지 않는다(약관·문서 단어가 없으므로 매칭되지 않음).
    (re.compile(r"[ \t]*\[[^\[\]]*(?:약관|문서)[^\[\]]*\]"), ""),
    (re.compile(r"[\(（]\s*[\)）]"), ""),   # 기호·표기를 지운 뒤 남는 빈 괄호 정리
    (re.compile(r"[ \t]+([.,)])"), r"\1"),  # 표기 제거 후 남는 '봅니다 .' 같은 어색한 공백 정리
]


def _scrub(text: str) -> str:
    for pat, rep in _SCRUB_PATTERNS:
        text = pat.sub(rep, text)
    # 표현 제거 후 남는 이중 공백 정리 (줄바꿈은 건드리지 않는다)
    return re.sub(r"[ \t]{2,}", " ", text)


_SUGGEST_RE = re.compile(r"\[\s*다음\s*질문\s*\]\s*(.*)\Z", re.S)


def _split_suggestions(answer: str) -> tuple[str, list[str]]:
    """답변 끝의 [다음질문] 블록을 잘라내 (본문, 추천질문 목록) 으로 나눈다.

    모델이 블록을 빠뜨릴 수도 있으므로, 없으면 빈 목록을 돌려주고 본문은 그대로 둔다.
    """
    answer = _scrub(answer or "")
    m = _SUGGEST_RE.search(answer)
    if not m:
        return answer.strip(), []
    body = answer[: m.start()].rstrip()
    items: list[str] = []
    for line in m.group(1).splitlines():
        q = re.sub(r"^\s*(?:[-•*]|\d+[.)])\s*", "", line).strip()
        q = q.strip("\"'`[]")
        if q and q not in items:
            items.append(q[:40])
    return body, items[:3]


def _generate_fallback(query: str, hits: list[dict]) -> str:
    if not hits:
        return ("제공된 약관 문서에서 관련 조항을 찾지 못했어요. 질문을 조금 더 구체적으로 "
                "(예: '보험금은 언제 지급되나요?', '보험료 갱신은 어떻게 되나요?') 다시 물어봐 주세요.")
    top = hits[0]
    body = re.sub(r"\n{2,}", " ", top["text"]).strip()[:400]
    return (f"【{top['title']}】 {body}\n\n"
            f"(약관 p.{top['page']} 발췌 기준)\n"
            "※ 본 답변은 제공된 문서 기반의 일반 안내이며, 정확한 내용은 약관 원문 및 정식 상담을 통해 확인하시기 바랍니다.")


@traceable(run_type="chain", name="rag_answer")
def _answer_question_traced(
    message: str,
    model_type: str,
    history: list[dict] | None = None,
    student_context: str = "",
) -> dict:
    """질문 → {answer, sources, llm, suggestions}.  history=[{role, content}, ...] (선택).
       student_context: 로그인 학생의 확정 산출값(보험료 등)을 넣으면 개인화 설명.
       suggestions: 답변 끝 [다음질문] 블록에서 뽑은 추천 질문 (화면에서 버튼으로 표시)."""
    query = (message or "").strip()
    if not query:
        return {"answer": "질문을 입력해 주세요.", "sources": [], "llm": False, "suggestions": []}
    hits = retrieve(query, k=5)
    sources = [{"page": h["page"], "title": h["title"]} for h in hits]
    if _llm_enabled():
        try:
            raw, provider = _generate(query, hits, history or [], student_context)
            answer, suggestions = _split_suggestions(raw)
            return {"answer": answer, "sources": sources, "llm": True,
                    "provider": provider, "suggestions": suggestions}
        except Exception as e:  # noqa: BLE001 — 어떤 오류든 폴백
            return {"answer": _generate_fallback(query, hits), "sources": sources,
                    "llm": False, "suggestions": [], "error": str(e)}
    return {"answer": _generate_fallback(query, hits), "sources": sources,
            "llm": False, "suggestions": []}


def answer_question(message: str, history: list[dict] | None = None, student_context: str = "") -> dict:
    """모델을 먼저 확정해 LangSmith의 rag_answer Input에 model_type도 함께 기록."""
    provider = pick_provider()
    return _answer_question_traced(
        message=message,
        model_type=selected_model_type(provider),
        history=history,
        student_context=student_context,
    )


if __name__ == "__main__":
    for q in ["보험금은 언제 지급되나요?", "청약철회는 어떻게 하나요?", "보험료 갱신은 어떤 기준인가요?"]:
        out = answer_question(q)
        print(f"\nQ: {q}\n[llm={out['llm']} · 출처 {[s['page'] for s in out['sources']]}]\nA: {out['answer'][:300]}")
