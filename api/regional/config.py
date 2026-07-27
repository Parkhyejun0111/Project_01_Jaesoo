"""지역계수 파이프라인의 환경설정 — 키는 전부 환경변수로만 읽는다.

하드코딩된 인증키는 이 패키지 어디에도 두지 않는다. 값은 저장소 루트 `.env`
(형식은 `.env.example` 참고) 에 있고, `python-dotenv` 가 그것을 읽는다.
"""
from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # noqa: BLE001 — dotenv 없으면 OS 환경변수만 쓴다
    def load_dotenv(*_a, **_kw):  # type: ignore[misc]
        return False

# api/regional/config.py → api/ → <repo>
API_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = API_DIR.parent

load_dotenv(REPO_ROOT / ".env", override=False)
load_dotenv(API_DIR / ".env", override=False)


class ConfigError(RuntimeError):
    """필수 환경변수가 비어 있을 때."""


def _require(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise ConfigError(
            f"환경변수 {name} 가 비어 있다. 저장소 루트 .env 에 채워라 (.env.example 참고)."
        )
    return value


def seoul_api_key() -> str:
    return _require("SEOUL_API_KEY")


def kosis_api_key() -> str:
    return _require("KOSIS_API_KEY")


def kosis_org_id() -> str:
    return (os.getenv("KOSIS_ORG_ID") or "101").strip()


def kosis_tbl_id() -> str:
    return (os.getenv("KOSIS_TBL_ID") or "DT_1PE105").strip()


def kosis_item_id() -> str | None:
    """항목코드 고정 지정. 비우면 메타에서 '평균' 항목을 찾아 쓴다."""
    return (os.getenv("KOSIS_ITM_ID") or "").strip() or None


def kosis_year() -> str | None:
    """수집 연도 고정 지정. 비우면 메타(type=PRD)의 최신 확정연도를 쓴다."""
    return (os.getenv("KOSIS_YEAR") or "").strip() or None


# ── 계수 JSON 위치 ──────────────────────────────────────────────────────────
#   정본은 <repo>/config. api/config 는 배포 번들용 사본이다 — Vercel 은 api/ 를
#   함수 루트로 잡으므로 저장소 루트의 config/ 가 번들에 들어가지 않는다.
#   배치(collect.py)가 두 곳에 같은 내용을 함께 쓴다.
def config_dirs() -> list[Path]:
    override = (os.getenv("REGION_CONFIG_DIR") or "").strip()
    if override:
        return [Path(override).expanduser().resolve()]
    return [REPO_ROOT / "config", API_DIR / "config"]


SIDO_FILE = "sido_coefficients.json"
GU_FILE = "seoul_gu_coefficients.json"
FINAL_FILE = "region_coefficients_final.json"
LOG_FILE = "collect_log.jsonl"


def resolve_read_path(filename: str) -> Path | None:
    """읽기용 — 존재하는 첫 경로. 배포본에서는 api/config 만 존재한다."""
    for directory in config_dirs():
        candidate = directory / filename
        if candidate.is_file():
            return candidate
    return None
