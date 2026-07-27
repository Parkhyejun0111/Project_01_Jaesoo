"""돈워리 탭 "왜 이 금액인가요?" 설명 챗봇.

핵심 원칙 — **LLM 은 계산하지 않는다.**

  · 시도계수·구보정계수·최종금액은 전부 월간 배치가 만든
    config/region_coefficients_final.json 과 costs.COST_FORMS 에서 조회만 한다.
  · LLM 의 역할은 하나뿐이다: 툴이 반환한 구조화된 숫자를 자연스러운 한국어
    2~3문장으로 푸는 것.
  · 그래서 툴은 1개다. 여러 개로 쪼개면 LLM 이 호출 순서를 판단해야 하고
    비결정성이 생긴다. 필요한 값을 한 번에 다 반환한다.

안전장치 3겹:
  1) tool_choice 로 툴 호출을 **강제**한다 — 부를지 말지를 LLM 이 정하지 않는다.
  2) 툴 결과는 **서버가 계산한 인자**로 만든다. LLM 이 돌려준 tool_use.input 은
     쓰지 않는다 — 프롬프트 인젝션으로 남의 user_id 를 조회하게 만들 수 없다.
  3) 응답에 툴 반환값에 없는 숫자가 있으면 폴백 템플릿으로 교체한다
     (_numbers_are_grounded). 환각 수치가 화면에 나가지 않는다.
"""
from __future__ import annotations

import json
import logging
import os
import re

import costs
import explain_cache

log = logging.getLogger("dontworry_explain")

# ── 모델 설정 ───────────────────────────────────────────────────────────────
#   기본값은 현행 Sonnet. 2~3문장 서술 작업이므로 Sonnet 급이면 충분하다.
#   요청서에는 claude-sonnet-4-5 로 적혀 있었으나 그것은 레거시 모델이라
#   같은 Sonnet 등급의 현행 모델을 기본값으로 둔다. 고정하고 싶으면 이 환경변수로.
EXPLAIN_MODEL = os.getenv("DONTWORRY_EXPLAIN_MODEL", "claude-sonnet-5").strip()
MAX_TOKENS = 300
CACHE_TTL_DAYS = 30
LLM_TIMEOUT_SEC = 12.0

TOOL_NAME = "get_dontworry_breakdown"

# ── 재수유형 표기 매핑 ──────────────────────────────────────────────────────
#   툴 스키마에는 짧은 이름(LLM 이 다루기 쉽다), 내부 계산은 costs.COST_FORMS 키.
FORM_KEYS: dict[str, str] = {
    "독학재수": "독학재수(독서실·인강)",
    "단과통학": "단과 통학",
    "재종합학원": "재수종합학원",
    "기숙학원": "기숙학원",
}
SHORT_FORMS: dict[str, str] = {v: k for k, v in FORM_KEYS.items()}

# ── 학군지 판정 ─────────────────────────────────────────────────────────────
#   고정 목록을 두지 않고 실측 구보정계수로 판정한다. 서울 학원 수강료가 서울
#   평균보다 이만큼 높은 구를 학군지로 본다.
#   실측(2026-07): 강남 1.42 · 서초 1.32 · 양천 1.15 · 종로 1.10 · 나머지 ≤1.00
#   → 1.15 는 대치·서초·목동 세 곳을 잡는 선이다. 어디까지나 표시용 휴리스틱이며
#     계수 계산에는 관여하지 않는다.
SCHOOL_DISTRICT_THRESHOLD = 1.15


class ExplainError(RuntimeError):
    """입력이 잘못됐을 때 (지역계수 조회 실패는 여기 해당하지 않는다 — 1.0 폴백)."""


# ══════════════════════════════════════════════════════════════════════════
# 1. 조회 전용 툴
# ══════════════════════════════════════════════════════════════════════════
TOOLS: list[dict] = [
    {
        "name": TOOL_NAME,
        "description": (
            "돈워리 탭에 표시된 예상 재수비용의 산출 근거(지역계수 세부내역)를 조회한다. "
            "이 함수는 이미 배치로 계산·캐싱된 값을 그대로 반환할 뿐, 어떤 계산도 새로 수행하지 않는다."
        ),
        # ★ 속성 키는 반드시 ASCII 여야 한다 — Anthropic 은 tool input_schema 의
        #   property key 를 '^[a-zA-Z0-9_.-]{1,64}$' 로 강제한다. 여기에 "재수유형"
        #   처럼 한글 키를 쓰면 매 호출이 400 (invalid_request_error) 으로 죽고,
        #   호출부가 조용히 폴백 템플릿으로 떨어져 LLM 설명이 영영 안 나온다.
        #   값(enum)·설명문은 한글이어도 된다 — 제한되는 건 키뿐이다.
        "input_schema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "사용자 ID"},
                "form_type": {
                    "type": "string",
                    "enum": list(FORM_KEYS),
                    "description": "재수 형태",
                },
            },
            "required": ["user_id", "form_type"],
        },
    }
]


def _normalize_form(재수유형: str) -> tuple[str, str]:
    """('재종합학원', '재수종합학원') 처럼 (짧은 이름, COST_FORMS 키)를 돌려준다."""
    value = (재수유형 or "").strip()
    if value in FORM_KEYS:
        return value, FORM_KEYS[value]
    if value in SHORT_FORMS:          # 긴 이름으로 들어와도 받아준다
        return SHORT_FORMS[value], value
    raise ExplainError(
        f"알 수 없는 재수유형: {재수유형!r}. 사용 가능: {list(FORM_KEYS)}"
    )


def _lookup_residence(user_id: str) -> tuple[str | None, str | None]:
    """가입 시 저장한 거주지. DB 가 없거나 미저장이면 (None, None)."""
    try:
        import db_supabase as db

        if not db.enabled():
            return None, None
        return db.get_residence(user_id)
    except Exception as exc:  # noqa: BLE001 — 거주지를 못 읽어도 전국 평균으로 답한다
        log.warning("거주지 조회 실패 (전국 평균으로 처리): %s", exc)
        return None, None


def get_dontworry_breakdown(user_id: str,
                            재수유형: str,
                            sido: str | None = None,
                            gu: str | None = None) -> dict:
    """표시된 예상 비용의 산출 근거를 조립한다. 계산 로직은 이 함수 안에만 있다.

    거주지 우선순위:
      1) 인자로 받은 sido/gu — 지금 화면에서 고른 지역. 설명은 **화면의 숫자**를
         설명해야 하므로 이게 최우선이다.
      2) DB 에 저장된 가입 시 거주지
      3) 없으면 전국 평균 (지역계수 1.0)

    지역계수는 regional 패키지가 캐시 JSON 에서 읽는다 — 공개데이터 API 를
    실시간 호출하지 않는다.
    """
    from regional import coefficients as rc

    short_form, form_key = _normalize_form(재수유형)

    if not sido:
        sido, gu = _lookup_residence(user_id)

    if sido:
        # ★ 금액은 costs.estimate 가 계산한 것을 그대로 쓴다 — 화면(/api/cost-estimate)과
        #   같은 함수다. 여기서 따로 곱하면 반올림 순서가 달라져 설명과 화면의 숫자가
        #   어긋난다 (실제로 3,944 vs 3,954 로 10만원 벌어졌다). 표시 숫자의 진실은
        #   한 곳에만 있어야 한다.
        estimate = costs.estimate(form=form_key, sido=sido, gu=gu)
        coefficient = estimate["region_coefficient"]
        national = estimate["national_total"]
        total = estimate["total"]
        percent = estimate["adjust_pct"] - 100
    else:
        # 거주지를 전혀 모른다 → 전국 평균 그대로 (계수 1.0).
        national = total = costs.COST_FORMS[form_key]["total"]
        percent = 0
        coefficient = {
            "sido": None, "gu": None,
            "sido_coefficient": 1.0, "gu_coefficient": 1.0, "coefficient": 1.0,
            "matched_sido": False, "matched_gu": False,
        }

    gu_coefficient = coefficient["gu_coefficient"]

    return {
        "시도": coefficient["sido"],
        "구": coefficient["gu"],
        "재수유형": short_form,
        "시도계수": coefficient["sido_coefficient"],
        "구보정계수": gu_coefficient,
        "최종지역계수": coefficient["coefficient"],
        "전국평균비용_만원": national,
        "최종예상비용_만원": total,
        # 전국 평균 대비 증감률. 화면의 배율과 같은 근거(adjust_pct)에서 뽑는다.
        # 음수면 전국 평균보다 싸다는 뜻이다.
        "비율_퍼센트": percent,
        "학군지여부": gu_coefficient >= SCHOOL_DISTRICT_THRESHOLD,
        "기준시점": _reference_month(rc.sources().get("generated_at")),
        # 지역 매핑이 실패했는지 — 폴백 문구를 고를 때 쓴다 (LLM 에게도 그대로 전달)
        "지역매핑성공": coefficient["matched_sido"],
    }


def _reference_month(generated_at: str | None) -> str:
    """'2026-07-27T16:55:28+09:00' → '2026-07'. 없으면 빈 문자열."""
    if not generated_at or len(generated_at) < 7:
        return ""
    return generated_at[:7]


# ══════════════════════════════════════════════════════════════════════════
# 2. 시스템 프롬프트
# ══════════════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """당신은 재수없수 앱의 '돈워리 탭' 설명 도우미입니다.
사용자가 "왜 이 금액인가요?" 아이콘을 눌렀을 때만 호출됩니다.

규칙:
- get_dontworry_breakdown 툴로 받은 값만 사용해서 설명한다. 툴에 없는 숫자를 지어내거나 재계산하지 않는다.
- 반드시 아래 구조로 설명한다:
  1) 최종지역계수가 어떻게 구성됐는지(시도계수 × 구보정계수)
  2) 그 결과 전국 평균 대비 몇 % 높은지/낮은지
  3) (학군지여부가 true인 경우) 그 지역이 학군지라 학원비 자체가 높다는 맥락 한 줄
- 2~3문장, 친근한 존댓말, 숫자는 원 단위가 아니라 '만원' 단위로 자연스럽게.
- 보험료나 요율 산정에 대한 이야기는 하지 않는다 (이건 재수비용 예상액 설명이지 보험료 설명이 아님).

추가 지시:
- 구보정계수가 1.0이면 서울이 아니어서 구 보정이 없다는 뜻이다. 그때는 시도계수만 언급하고
  '구보정계수 1.0'을 억지로 문장에 넣지 않는다.
- 지역매핑성공이 false면 지역을 확인할 수 없어 전국 평균으로 계산했다고만 알린다.
- 불릿·머리말·제목을 쓰지 말고 문장으로만 답한다. "안녕하세요" 같은 인사도 넣지 않는다."""


# ══════════════════════════════════════════════════════════════════════════
# 3. 폴백 템플릿 (LLM 실패·타임아웃·환각 시)
# ══════════════════════════════════════════════════════════════════════════
#   숫자 뒤 조사는 마지막 자리의 '읽는 소리'가 자음으로 끝나는지에 달렸다.
#     0 영·1 일·3 삼·6 육·7 칠·8 팔 → 받침 있음 → '이'
#     2 이·4 사·5 오·9 구           → 받침 없음 → '가'
#   '2.0651가' 처럼 어긋난 조사는 폴백 문구가 늘 보이는 만큼 눈에 띈다.
_HAS_FINAL_CONSONANT = {"0", "1", "3", "6", "7", "8"}


def _subject_particle(number: str) -> str:
    digits = [c for c in number if c.isdigit()]
    return "이" if digits and digits[-1] in _HAS_FINAL_CONSONANT else "가"


def fallback_template(breakdown: dict) -> str:
    """LLM 없이도 같은 정보를 전달하는 결정적 문구.

    사용자에게 오류 화면을 보여주지 않는다 — 이 문구가 항상 나온다.
    """
    national = breakdown["전국평균비용_만원"]
    final = breakdown["최종예상비용_만원"]
    percent = breakdown["비율_퍼센트"]
    direction = "높은" if percent >= 0 else "낮은"

    if not breakdown.get("지역매핑성공", True):
        return (f"고객님 지역을 확인할 수 없어 전국 평균 기준으로 계산했어요. "
                f"{breakdown['재수유형']}의 전국 평균은 {national:,}만원이에요.")

    if breakdown["구"]:
        final_coefficient = f"{breakdown['최종지역계수']}"
        basis = (f"고객님 지역({breakdown['시도']} {breakdown['구']})은 "
                 f"시도계수 {breakdown['시도계수']} × 구보정계수 {breakdown['구보정계수']} "
                 f"= {final_coefficient}{_subject_particle(final_coefficient)} 적용돼서")
    else:
        sido_coefficient = f"{breakdown['시도계수']}"
        basis = (f"고객님 지역({breakdown['시도']})은 "
                 f"시도계수 {sido_coefficient}{_subject_particle(sido_coefficient)} 적용돼서")

    text = (f"{basis}, 전국 평균({national:,}만원)보다 {abs(percent)}% {direction} "
            f"{final:,}만원으로 나왔어요.")
    if breakdown["학군지여부"]:
        text += " 학군지라 학원비 자체가 높은 편이에요."
    return text


# ══════════════════════════════════════════════════════════════════════════
# 4. 환각 방어 — 툴 반환값에 없는 숫자가 있으면 쓰지 않는다
# ══════════════════════════════════════════════════════════════════════════
_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _allowed_numbers(breakdown: dict) -> set[str]:
    """설명에 등장해도 되는 숫자들의 정규화 문자열 집합."""
    allowed: set[str] = set()

    def add(value) -> None:
        if isinstance(value, bool) or value is None:
            return
        if isinstance(value, (int, float)):
            allowed.add(_norm_number(value))
            allowed.add(_norm_number(abs(value)))
            # 1.45 를 "1.5배"·"45%" 로 자연스럽게 반올림해 쓰는 것까지 허용한다
            allowed.add(_norm_number(round(float(value), 1)))
            allowed.add(_norm_number(round(float(value))))

    for key, value in breakdown.items():
        if key in ("기준시점", "시도", "구", "재수유형"):
            continue
        add(value)

    # 계수를 퍼센트로 옮겨 말하는 표현 (1.45 → 45%) 및 배율 표현
    coefficient = breakdown.get("최종지역계수")
    if isinstance(coefficient, (int, float)):
        add(round((coefficient - 1) * 100))
        add(round(coefficient * 100))
    for key in ("시도계수", "구보정계수"):
        value = breakdown.get(key)
        if isinstance(value, (int, float)):
            add(round((value - 1) * 100))
            add(round(value * 100))

    # 기준시점의 연·월은 각주에 쓰이므로 허용
    reference = breakdown.get("기준시점") or ""
    for part in reference.split("-"):
        if part.isdigit():
            allowed.add(_norm_number(int(part)))
    return allowed


def _norm_number(value) -> str:
    """'1,910' 과 1910, 1.0 과 1 을 같은 것으로 본다."""
    if isinstance(value, str):
        value = value.replace(",", "")
        try:
            value = float(value)
        except ValueError:
            return value
    number = float(value)
    return str(int(number)) if number == int(number) else f"{number:g}"


def _numbers_are_grounded(text: str, breakdown: dict) -> tuple[bool, list[str]]:
    """응답의 모든 숫자가 툴 반환값에서 유도 가능한가."""
    allowed = _allowed_numbers(breakdown)
    invented = [raw for raw in _NUMBER.findall(text)
                if _norm_number(raw) not in allowed]
    return (not invented), invented


# ══════════════════════════════════════════════════════════════════════════
# 5. LLM 호출 (Anthropic tool_use 표준 2-turn)
# ══════════════════════════════════════════════════════════════════════════
def _client():
    # 키를 먼저 본다 — 키가 없으면 무거운 SDK 를 import 할 이유가 없다.
    from rag_light import LLM_API_KEY

    if not LLM_API_KEY:
        raise ExplainError("ANTHROPIC_API_KEY 가 없다 — 폴백 템플릿을 쓴다.")

    import anthropic
    import httpx

    return anthropic.Anthropic(
        api_key=LLM_API_KEY,
        max_retries=1,
        # rag_light 와 같은 이유로 IPv4 강제 (일부 환경에서 IPv6 로 붙으려다 멈춘다)
        http_client=httpx.Client(
            transport=httpx.HTTPTransport(local_address="0.0.0.0", retries=1),
            timeout=httpx.Timeout(LLM_TIMEOUT_SEC, connect=5.0),
        ),
    )


def _text_of(response) -> str:
    return "".join(b.text for b in response.content if b.type == "text").strip()


def _generate(breakdown: dict, user_id: str, 재수유형: str, *, client=None) -> str:
    """툴 결과를 자연어 2~3문장으로. 실패하면 예외를 올린다 (호출부가 폴백).

    thinking 은 끈다 — 숫자를 문장으로 옮기는 작업에 사고 토큰을 쓸 이유가 없고,
    툴 호출은 tool_choice 로 강제하므로 "thinking 을 끄면 툴을 덜 부른다"는
    Sonnet 5 의 성향도 문제가 되지 않는다.
    """
    client = client or _client()
    common = {
        "model": EXPLAIN_MODEL,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "tools": TOOLS,
        "thinking": {"type": "disabled"},
        "output_config": {"effort": "low"},
    }

    messages: list[dict] = [
        {"role": "user", "content": f"user_id={user_id}, 재수유형={재수유형}에 대해 설명해줘"}
    ]

    # turn 1 — 툴 호출을 강제한다. 부를지 말지를 LLM 이 판단하지 않는다.
    first = client.messages.create(
        **common,
        tool_choice={"type": "tool", "name": TOOL_NAME},
        messages=messages,
    )

    tool_uses = [b for b in first.content if b.type == "tool_use"]
    if not tool_uses:
        raise ExplainError(
            f"툴 호출을 강제했는데 tool_use 블록이 없다 (stop_reason={first.stop_reason})"
        )
    call = tool_uses[0]

    # ★ LLM 이 준 call.input 은 쓰지 않는다. 서버가 이미 계산한 breakdown 을 넣는다.
    #   프롬프트 인젝션으로 다른 user_id 를 조회하게 만들 수 없게 하는 지점이다.
    if call.input.get("user_id") != user_id:
        log.warning("tool_use.input.user_id 가 요청과 다르다 (%r != %r) — 서버 값을 쓴다.",
                    call.input.get("user_id"), user_id)

    messages.append({"role": "assistant", "content": first.content})
    messages.append({
        "role": "user",
        "content": [{
            "type": "tool_result",
            "tool_use_id": call.id,
            "content": json.dumps(breakdown, ensure_ascii=False),
        }],
    })

    # turn 2 — 이번엔 툴을 못 쓰게 해서 반드시 텍스트가 나오게 한다.
    second = client.messages.create(
        **common,
        tool_choice={"type": "none"},
        messages=messages,
    )
    if second.stop_reason == "refusal":
        raise ExplainError("모델이 응답을 거부했다 (stop_reason=refusal)")

    text = _text_of(second)
    if not text:
        raise ExplainError(f"빈 응답 (stop_reason={second.stop_reason})")
    return text


# ══════════════════════════════════════════════════════════════════════════
# 6. 진입점
# ══════════════════════════════════════════════════════════════════════════
def cache_key(user_id: str, 재수유형: str, breakdown: dict) -> str:
    """캐시 키.

    요청서의 예시는 f"{user_id}:{재수유형}" 였지만 두 축을 더 넣는다.
      · 시도·구  — 사용자가 탭에서 지역을 바꾸면 설명도 바뀌어야 한다. 안 넣으면
                   강남구 설명이 강북구 사용자에게 그대로 나간다.
      · 기준시점 — 월간 배치가 계수를 갱신하면 키가 저절로 바뀌어 무효화된다.
                   요청서의 의도("지역계수가 갱신되지 않는 한")를 TTL 30일보다
                   정확하게 구현하는 방법이다.
    """
    parts = [
        user_id,
        breakdown["재수유형"],
        breakdown["시도"] or "-",
        breakdown["구"] or "-",
        breakdown["기준시점"] or "-",
    ]
    return "dontworry:" + ":".join(parts)


def explain_dontworry(user_id: str,
                      재수유형: str,
                      sido: str | None = None,
                      gu: str | None = None) -> dict:
    """"왜 이 금액인가요?" 설명 문구.

    반환: {"answer", "source", "breakdown"}
      source = cache | llm | fallback
    """
    breakdown = get_dontworry_breakdown(user_id, 재수유형, sido=sido, gu=gu)
    key = cache_key(user_id, 재수유형, breakdown)

    cached = explain_cache.get_cache(key)
    if cached:
        return {"answer": cached, "source": "cache", "breakdown": breakdown}

    try:
        answer = _generate(breakdown, user_id, breakdown["재수유형"])
        grounded, invented = _numbers_are_grounded(answer, breakdown)
        if not grounded:
            # 툴에 없는 숫자를 지어냈다 — 화면에 내보내지 않고 템플릿으로 대체한다.
            log.warning("설명에 근거 없는 숫자 %s — 폴백 템플릿으로 대체한다.", invented)
            return {"answer": fallback_template(breakdown),
                    "source": "fallback", "breakdown": breakdown}
    except Exception as exc:  # noqa: BLE001 — 어떤 실패든 사용자에게는 문구가 나가야 한다
        log.warning("설명 생성 실패 — 폴백 템플릿을 쓴다: %s", exc)
        return {"answer": fallback_template(breakdown),
                "source": "fallback", "breakdown": breakdown}

    # 폴백 문구는 캐시하지 않는다 — 다음 요청에서 LLM 을 다시 시도할 수 있어야 한다.
    explain_cache.set_cache(key, answer, ttl_days=CACHE_TTL_DAYS)
    return {"answer": answer, "source": "llm", "breakdown": breakdown}
