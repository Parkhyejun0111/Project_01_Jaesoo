"""설명 문구 캐시 — 같은 조합이면 LLM 을 다시 부르지 않는다.

이 저장소에는 Redis 가 없다. 대신 두 층으로 둔다.

  1층 · 프로세스 메모리  — 같은 서버리스 인스턴스가 살아 있는 동안 즉시 응답 (0ms)
  2층 · Supabase 테이블  — 인스턴스가 죽어도, 다른 인스턴스에서도 공유된다

DB 가 꺼져 있으면(로컬·테스트) 1층만으로 동작한다. 캐시는 있으면 좋은 것이므로
어떤 실패도 호출부로 올리지 않는다 — 캐시 미스로 취급하고 LLM 을 부르면 된다.
"""
from __future__ import annotations

import logging
import threading
import time

log = logging.getLogger("explain_cache")

DEFAULT_TTL_DAYS = 30

_lock = threading.Lock()
_memory: dict[str, tuple[str, float]] = {}   # key → (value, expires_at epoch)

# 메모리 계층이 무한정 커지지 않게 하는 상한. 초과하면 만료가 가까운 것부터 버린다.
MAX_MEMORY_ENTRIES = 512


def _now() -> float:
    return time.time()


# ── 1층: 프로세스 메모리 ────────────────────────────────────────────────────
def _memory_get(key: str) -> str | None:
    with _lock:
        entry = _memory.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at <= _now():
            _memory.pop(key, None)
            return None
        return value


def _memory_set(key: str, value: str, expires_at: float) -> None:
    with _lock:
        if len(_memory) >= MAX_MEMORY_ENTRIES and key not in _memory:
            for stale, _ in sorted(_memory.items(), key=lambda kv: kv[1][1])[:64]:
                _memory.pop(stale, None)
        _memory[key] = (value, expires_at)


# ── 2층: Supabase ───────────────────────────────────────────────────────────
def _db_get(key: str) -> tuple[str, float] | None:
    import db_supabase as db

    if not db.enabled():
        return None
    try:
        return db.get_explain_cache(key)
    except Exception as exc:  # noqa: BLE001 — 캐시 실패가 기능을 막지 않는다
        log.warning("설명 캐시 조회 실패 (미스로 처리): %s", exc)
        return None


def _db_set(key: str, value: str, ttl_seconds: int) -> None:
    import db_supabase as db

    if not db.enabled():
        return
    try:
        db.set_explain_cache(key, value, ttl_seconds)
    except Exception as exc:  # noqa: BLE001
        log.warning("설명 캐시 저장 실패 (무시): %s", exc)


# ── 공개 API ────────────────────────────────────────────────────────────────
def get_cache(key: str) -> str | None:
    """캐시 히트면 문구, 미스면 None."""
    hit = _memory_get(key)
    if hit is not None:
        return hit

    row = _db_get(key)
    if row is None:
        return None
    value, expires_at = row
    if expires_at <= _now():
        return None
    _memory_set(key, value, expires_at)   # 2층 히트를 1층으로 끌어올린다
    return value


def set_cache(key: str, value: str, ttl_days: int = DEFAULT_TTL_DAYS) -> None:
    ttl_seconds = max(int(ttl_days * 86400), 60)
    _memory_set(key, value, _now() + ttl_seconds)
    _db_set(key, value, ttl_seconds)


def clear_memory() -> None:
    """테스트용 — 1층만 비운다."""
    with _lock:
        _memory.clear()


def memory_size() -> int:
    with _lock:
        return len(_memory)
