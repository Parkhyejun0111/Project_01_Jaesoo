"""월 1회 배치 — 두 공개데이터를 재수집해 config/*.json 을 갱신한다.

  python -m regional.collect            # 두 소스 모두
  python -m regional.collect --kosis    # 시도계수만
  python -m regional.collect --seoul    # 구보정계수만
  python -m regional.collect --dry-run  # 파일은 쓰지 않고 결과만 출력

안정성 규칙 (실시간 호출 금지 · 폴백 필수):
  · 한 소스가 실패하면 그 소스의 직전 캐시를 그대로 유지한다. 파일을 비우거나
    1.0 으로 덮어쓰지 않는다.
  · 두 소스가 모두 실패하면 종료코드 1 로 끝내되 기존 파일은 손대지 않는다.
  · 매 실행마다 config/collect_log.jsonl 에 수집 건수와 계수 변화량을 남긴다.
    이상치가 생기면 이 로그의 max_delta 로 먼저 확인한다.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

if __package__ in (None, ""):  # `python collect.py` 로도 돌 수 있게
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    __package__ = "regional"

from . import coefficients, config, kosis, seoul  # noqa: E402

log = logging.getLogger("regional.collect")

# 계수가 이만큼 넘게 흔들리면 경고를 남긴다 (사교육비조사는 연 1회 공표라 보통 0).
DELTA_WARN = 0.15


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _write_json(filename: str, payload: dict) -> list[Path]:
    """설정 디렉터리 전부에 같은 내용을 쓴다 (정본 + 배포 번들 사본)."""
    written = []
    for directory in config.config_dirs():
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / filename
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                       encoding="utf-8")
        tmp.replace(path)  # 원자적 교체 — 읽는 쪽이 반쪽 파일을 보지 않게
        written.append(path)
    return written


def _read_existing(filename: str) -> dict:
    path = config.resolve_read_path(filename)
    if path is None:
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        log.warning("기존 %s 를 읽지 못했다 — 변화량 비교를 건너뛴다.", filename)
        return {}


def _diff(before: dict, after: dict) -> dict:
    """계수 변화량 요약 — 배치 로그의 핵심."""
    keys = set(before) | set(after)
    deltas = {
        k: round(float(after[k]) - float(before[k]), 4)
        for k in sorted(keys)
        if k in before and k in after and float(after[k]) != float(before[k])
    }
    biggest = max(deltas.items(), key=lambda kv: abs(kv[1])) if deltas else None
    return {
        "changed": len(deltas),
        "added": sorted(set(after) - set(before)),
        "removed": sorted(set(before) - set(after)),
        "deltas": deltas,
        "max_delta_key": biggest[0] if biggest else None,
        "max_delta": biggest[1] if biggest else 0.0,
    }


def _append_log(entry: dict) -> None:
    line = json.dumps(entry, ensure_ascii=False)
    for directory in config.config_dirs():
        try:
            directory.mkdir(parents=True, exist_ok=True)
            with (directory / config.LOG_FILE).open("a", encoding="utf-8") as fp:
                fp.write(line + "\n")
        except OSError as exc:  # 로그 실패가 배치를 죽이지는 않게
            log.warning("배치 로그 기록 실패 (%s): %s", directory, exc)


# ── 소스별 수집 ─────────────────────────────────────────────────────────────
def collect_kosis(*, dry_run: bool) -> dict:
    before = _read_existing(config.SIDO_FILE).get("coefficients", {})
    result = kosis.collect()
    payload = {"generated_at": _now(), **result}
    diff = _diff(before, result["coefficients"])
    if not dry_run:
        _write_json(config.SIDO_FILE, payload)
    log.info("KOSIS 시도계수 %d개 (기준연도 %s, 전국평균 %.2f만원) — 변경 %d",
             len(result["coefficients"]), result["source"]["period"],
             result["national_average_manwon"], diff["changed"])
    return {
        "ok": True,
        "count": len(result["coefficients"]),
        "period": result["source"]["period"],
        "item_id": result["source"]["item_id"],
        "national_average_manwon": result["national_average_manwon"],
        "diff": diff,
        "payload": payload,
    }


def collect_seoul(*, dry_run: bool) -> dict:
    before = _read_existing(config.GU_FILE).get("coefficients", {})
    result = seoul.collect()
    payload = {"generated_at": _now(), **result}
    diff = _diff(before, result["coefficients"])
    if not dry_run:
        _write_json(config.GU_FILE, payload)
    src = result["source"]
    log.info("서울 학원 %d건 수집 → 입시·보습 %d건 → 수강료 공개 %d곳 → 채택 %d곳, 구 %d개 — 변경 %d",
             src["fetched_rows"], src["realm_rows"], src["priced_academies"],
             src["kept_academies"], len(result["coefficients"]), diff["changed"])
    return {
        "ok": True,
        "count": len(result["coefficients"]),
        "fetched_rows": src["fetched_rows"],
        "realm_rows": src["realm_rows"],
        "priced_academies": src["priced_academies"],
        "kept_academies": src["kept_academies"],
        "seoul_average_fee_won": result["seoul_average_fee_won"],
        "diff": diff,
        "payload": payload,
    }


def _final_cache(sido_doc: dict, gu_doc: dict) -> dict:
    """config/region_coefficients_final.json — 앱이 매번 읽는 결합 캐시.

    combined 에 서울 25개 구의 곱셈 결과를 미리 펼쳐 둔다. 런타임은 곱셈만 해도
    되지만, 값이 미리 보이면 배치 결과를 눈으로 검증하기 쉽다.
    """
    sido = sido_doc.get("coefficients", {})
    gu = gu_doc.get("coefficients", {})
    combined = {
        f"서울 {name}": round(sido.get("서울", 1.0) * value, 4)
        for name, value in sorted(gu.items())
    }
    return {
        "generated_at": _now(),
        "formula": "최종 지역계수 = 시도계수 × 구보정계수 (서울 외 구보정계수 = 1.0)",
        "default": coefficients.DEFAULT_COEFFICIENT,
        "sido_coefficients": sido,
        "seoul_gu_coefficients": gu,
        "combined_seoul": combined,
        "sido_source": sido_doc.get("source", {}),
        "gu_source": gu_doc.get("source", {}),
    }


def _purge_explain_cache() -> None:
    """만료된 돈워리 설명 문구를 정리한다.

    계수가 갱신되면 설명 캐시 키(기준시점 포함)가 바뀌어 기존 문구는 더 이상 조회되지
    않는다 — 다만 행은 남으므로 배치 끝에 한 번 치운다. 실패해도 배치를 막지 않는다.
    """
    try:
        import db_supabase as db

        if not db.enabled():
            return
        log.info("설명 캐시 만료 행 %d개 정리", db.purge_expired_explain_cache())
    except Exception as exc:  # noqa: BLE001
        log.warning("설명 캐시 정리 실패 (무시): %s", exc)


def run(*, do_kosis: bool = True, do_seoul: bool = True, dry_run: bool = False) -> int:
    started = _now()
    results: dict[str, dict] = {}

    if do_kosis:
        try:
            results["kosis"] = collect_kosis(dry_run=dry_run)
        except Exception as exc:  # noqa: BLE001 — 어떤 실패든 캐시를 지켜야 한다
            log.error("KOSIS 수집 실패 — 직전 캐시를 유지한다: %s", exc)
            results["kosis"] = {"ok": False, "error": str(exc)}

    if do_seoul:
        try:
            results["seoul"] = collect_seoul(dry_run=dry_run)
        except Exception as exc:  # noqa: BLE001
            log.error("서울 학원 수집 실패 — 직전 캐시를 유지한다: %s", exc)
            results["seoul"] = {"ok": False, "error": str(exc)}

    # 결합 캐시는 성공한 쪽의 새 값 + 실패한 쪽의 직전 캐시로 만든다.
    sido_doc = results.get("kosis", {}).get("payload") or _read_existing(config.SIDO_FILE)
    gu_doc = results.get("seoul", {}).get("payload") or _read_existing(config.GU_FILE)

    final = None
    if sido_doc.get("coefficients"):
        final = _final_cache(sido_doc, gu_doc)
        if not dry_run:
            _write_json(config.FINAL_FILE, final)
            coefficients.load(refresh=True)
            _purge_explain_cache()
    else:
        log.error("시도계수가 없어 결합 캐시를 만들지 않았다 (기존 파일 유지).")

    any_ok = any(r.get("ok") for r in results.values())
    entry = {
        "started_at": started,
        "finished_at": _now(),
        "dry_run": dry_run,
        "status": "ok" if all(r.get("ok") for r in results.values()) else
                  ("partial" if any_ok else "failed"),
        "sources": {k: {kk: vv for kk, vv in v.items() if kk != "payload"}
                    for k, v in results.items()},
        "final_written": final is not None and not dry_run,
    }
    for name, result in results.items():
        delta = abs(result.get("diff", {}).get("max_delta", 0.0))
        if delta > DELTA_WARN:
            log.warning("%s 계수 변화량이 크다 (%s %+.4f) — 원본 이상치 확인 필요.",
                        name, result["diff"]["max_delta_key"], result["diff"]["max_delta"])
            entry.setdefault("warnings", []).append(
                f"{name}: {result['diff']['max_delta_key']} {result['diff']['max_delta']:+.4f}")

    if not dry_run:
        _append_log(entry)
    log.info("배치 종료 — status=%s", entry["status"])
    if dry_run and final:
        print(json.dumps(final, ensure_ascii=False, indent=2))
    return 0 if any_ok else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="지역계수 월간 재수집 배치")
    parser.add_argument("--kosis", action="store_true", help="시도계수만 수집")
    parser.add_argument("--seoul", action="store_true", help="구보정계수만 수집")
    parser.add_argument("--dry-run", action="store_true", help="파일을 쓰지 않고 결과만 출력")
    parser.add_argument("-q", "--quiet", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s %(message)s",
    )
    # 26페이지 × "HTTP 200 OK" 로 배치 로그가 묻히지 않게 한다.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    both = not (args.kosis or args.seoul)
    return run(do_kosis=both or args.kosis,
               do_seoul=both or args.seoul,
               dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
