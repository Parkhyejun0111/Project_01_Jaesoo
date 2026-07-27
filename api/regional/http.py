"""배치가 쓰는 HTTP 계층 — httpx 기반, 짧은 재시도 포함.

urllib 을 쓰지 않는 이유: 표준 라이브러리는 OS 트러스트 스토어에 의존하므로
TLS 를 가로채는 사내 프록시 환경에서 KOSIS(https) 호출이 CERTIFICATE_VERIFY_FAILED
로 죽는다. httpx 는 certifi 번들을 쓰므로 어느 환경에서나 같게 동작한다.
httpx 는 이미 api/requirements.txt 에 있는 의존성이다.

재시도는 네트워크 오류·타임아웃·5xx 에만 한다. 인증키 오류(4xx)는 재시도해도
같은 결과이므로 즉시 올린다. 여기서 모두 실패하면 호출부가 예외를 받고,
collect.py 가 직전 캐시를 유지한 채 끝낸다.
"""
from __future__ import annotations

import logging
import time

import httpx

log = logging.getLogger("regional.http")

TIMEOUT = 60.0
RETRIES = 3
BACKOFF_SEC = 1.5


class HttpError(RuntimeError):
    """재시도까지 소진한 뒤의 네트워크 실패."""


def get_text(url: str, params: dict[str, str] | None = None, *,
             timeout: float = TIMEOUT, retries: int = RETRIES) -> str:
    last: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = httpx.get(url, params=params, timeout=timeout,
                                 follow_redirects=True)
            if response.status_code >= 500:
                raise httpx.HTTPStatusError(
                    f"HTTP {response.status_code}", request=response.request,
                    response=response)
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status < 500:
                raise HttpError(f"{url} → HTTP {status}: {exc.response.text[:200]}") from exc
            last = exc
        except httpx.HTTPError as exc:
            last = exc
        if attempt < retries:
            wait = BACKOFF_SEC * attempt
            log.warning("요청 실패(%d/%d) — %.1fs 후 재시도: %s", attempt, retries, wait, last)
            time.sleep(wait)
    raise HttpError(f"{url} 요청이 {retries}회 모두 실패했다: {last}") from last
