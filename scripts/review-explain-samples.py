#!/usr/bin/env python3
"""돈워리 설명 문구 샘플 검수 — 실제 LLM 을 호출한다.

요청서의 "샘플 20개 정도 수동 검수" 항목을 위한 도구다. 자동 검사(툴 반환값에 없는
숫자·문장 수·금지어)를 먼저 걸러 주고, 사람이 읽을 문구를 함께 출력한다.

  ANTHROPIC_API_KEY=... python scripts/review-explain-samples.py
  ANTHROPIC_API_KEY=... python scripts/review-explain-samples.py --repeat 2

자동 검사만으로는 톤·자연스러움을 판정할 수 없으니, PASS 로 나온 문구도 눈으로
한 번 읽고 판단할 것. 캐시를 우회하므로 매 실행이 실제 호출이다(비용 발생).
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))

import dontworry_explain as dx  # noqa: E402

# 지역 × 재수유형을 섞어 20개 조합을 만든다 — 학군지/비학군지/서울밖/불명 지역 포함.
REGIONS = [
    ("서울", "강남구"),    # 학군지 상위
    ("서울", "서초구"),    # 학군지
    ("서울", "양천구"),    # 학군지(목동)
    ("서울", "노원구"),    # 서울 평균 근처
    ("서울", "강북구"),    # 서울 하위
    ("서울", None),        # 구 미선택
    ("경기", None),        # 수도권
    ("인천", None),
    ("전남", None),        # 최저
    ("없는지역", None),    # 매핑 실패
]
FORMS = list(dx.FORM_KEYS)

BANNED = ("보험료", "요율", "위험률", "손해율", "특약")


def _sentence_count(text: str) -> int:
    return len([s for s in re.split(r"[.!?]\s*", text) if s.strip()])


def check(text: str, breakdown: dict) -> list[str]:
    """자동으로 잡을 수 있는 규칙 위반 목록."""
    problems: list[str] = []

    grounded, invented = dx._numbers_are_grounded(text, breakdown)
    if not grounded:
        problems.append(f"툴에 없는 숫자: {invented}")

    sentences = _sentence_count(text)
    if not 2 <= sentences <= 4:      # 3문장 목표 + 1문장 여유
        problems.append(f"문장 수 {sentences} (2~3문장 규칙)")

    for word in BANNED:
        if word in text:
            problems.append(f"금지어 '{word}'")

    if breakdown["학군지여부"] and "학군" not in text:
        problems.append("학군지인데 학군지 맥락이 없다")
    if not breakdown["학군지여부"] and "학군" in text:
        problems.append("학군지가 아닌데 학군지를 언급했다")

    if breakdown["구보정계수"] == 1.0 and "구보정" in text:
        problems.append("서울이 아닌데 구보정계수를 언급했다")

    if "만원" not in text:
        problems.append("'만원' 단위 표기가 없다")
    for opener in ("안녕하세요", "- ", "* ", "#"):
        if text.strip().startswith(opener):
            problems.append(f"불릿/인사로 시작: {opener!r}")

    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description="설명 문구 샘플 검수")
    parser.add_argument("--repeat", type=int, default=1,
                        help="같은 조합을 몇 번씩 뽑을지 (문구 안정성 확인)")
    args = parser.parse_args()

    samples = [(sido, gu, FORMS[i % len(FORMS)])
               for i, (sido, gu) in enumerate(REGIONS * 2)][:20]

    passed = failed = 0
    for round_no in range(1, args.repeat + 1):
        if args.repeat > 1:
            print(f"\n{'=' * 72}\n  라운드 {round_no}/{args.repeat}\n{'=' * 72}")
        for index, (sido, gu, form) in enumerate(samples, 1):
            breakdown = dx.get_dontworry_breakdown("review", form, sido=sido, gu=gu)
            try:
                # 캐시를 건너뛰고 매번 실제 호출한다.
                text = dx._generate(breakdown, "review", form)
            except Exception as exc:  # noqa: BLE001
                print(f"{index:2d}. [호출실패] {sido} {gu or ''} · {form}: {exc}")
                failed += 1
                continue

            problems = check(text, breakdown)
            label = "PASS" if not problems else "FAIL"
            passed, failed = (passed + 1, failed) if not problems else (passed, failed + 1)

            location = f"{sido} {gu}" if gu else sido
            print(f"\n{index:2d}. [{label}] {location} · {form} "
                  f"(계수 {breakdown['최종지역계수']}, {breakdown['비율_퍼센트']:+d}%)")
            print(f"    {text}")
            for problem in problems:
                print(f"    ⚠ {problem}")

    total = passed + failed
    print(f"\n{'=' * 72}\n자동검사: {passed}/{total} PASS")
    print("톤·자연스러움은 위 문구를 직접 읽고 판단할 것.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
