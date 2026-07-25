"""업로드 저장소 — 로컬 디스크 / Vercel Blob / Supabase Storage.

Vercel Functions 의 파일시스템은 **요청 간 유지되지 않는다.** 영수증·카드사
이용내역을 로컬 디스크에 두면 업로드 직후를 제외한 모든 조회가 실패하므로,
저장 계층을 갈아끼울 수 있게 분리한다.

선택은 `RECEIPT_STORAGE` 환경변수로 한다.
  · local        — 로컬 디스크 (기본값, 개발용)
  · vercel-blob  — Vercel Blob   (BLOB_READ_WRITE_TOKEN 필요)
  · supabase     — Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요)

저장소는 `locator`(문자열)를 돌려주고, 이후 읽기·삭제는 그 값으로만 한다.
로컬은 절대경로, 원격은 URL 또는 객체 키가 된다.

※ 업로드 파일에는 개인정보가 포함될 수 있다. 운영에서는 버킷을 **비공개**로 두고
   접근통제·보존기간·안전삭제 정책을 별도로 적용해야 한다(README 참조).
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol
from urllib.parse import quote


class StorageError(RuntimeError):
    """저장소 계층에서 발생한 오류 (설정 누락·원격 실패)."""


class Storage(Protocol):
    name: str

    def save(self, stored_filename: str, data: bytes, content_type: str) -> str:
        """파일을 저장하고 locator 를 돌려준다."""

    def read(self, locator: str) -> bytes:
        """저장된 파일을 읽는다 (OCR 처리용)."""

    def delete(self, locator: str) -> None:
        """실패 롤백용. 없으면 조용히 넘어간다."""


# ── 로컬 디스크 ────────────────────────────────────────────────────────────
class LocalDiskStorage:
    name = "local"

    def __init__(self, upload_dir: Path):
        self.upload_dir = upload_dir

    def save(self, stored_filename: str, data: bytes, content_type: str) -> str:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        path = self.upload_dir / stored_filename
        partial = self.upload_dir / f"{stored_filename}.part"
        try:
            with partial.open("xb") as fh:
                fh.write(data)
            partial.replace(path)
        except Exception:
            partial.unlink(missing_ok=True)
            raise
        return str(path)

    def read(self, locator: str) -> bytes:
        return Path(locator).read_bytes()

    def delete(self, locator: str) -> None:
        Path(locator).unlink(missing_ok=True)


# ── Vercel Blob ────────────────────────────────────────────────────────────
class VercelBlobStorage:
    """https://vercel.com/docs/vercel-blob — PUT /{pathname} 로 업로드한다."""

    name = "vercel-blob"
    _ENDPOINT = "https://blob.vercel-storage.com"

    def __init__(self, token: str, prefix: str = "receipts"):
        if not token:
            raise StorageError(
                "RECEIPT_STORAGE=vercel-blob 인데 BLOB_READ_WRITE_TOKEN 이 없습니다."
            )
        self.token = token
        self.prefix = prefix.strip("/")

    def _request(self, method: str, url: str, **kwargs):
        import httpx

        headers = {"authorization": f"Bearer {self.token}", **kwargs.pop("headers", {})}
        with httpx.Client(timeout=30.0) as client:
            res = client.request(method, url, headers=headers, **kwargs)
        if res.status_code >= 400:
            raise StorageError(f"Vercel Blob {method} 실패 ({res.status_code}): {res.text[:200]}")
        return res

    def save(self, stored_filename: str, data: bytes, content_type: str) -> str:
        pathname = f"{self.prefix}/{stored_filename}"
        res = self._request(
            "PUT",
            f"{self._ENDPOINT}/{quote(pathname)}",
            content=data,
            headers={
                "x-content-type": content_type or "application/octet-stream",
                # 파일명을 그대로 노출하지 않도록 랜덤 접미사를 붙이지 않는다
                # (stored_filename 이 이미 UUID 라 추측이 불가능하다)
                "x-add-random-suffix": "0",
            },
        )
        return res.json()["url"]

    def read(self, locator: str) -> bytes:
        return self._request("GET", locator).content

    def delete(self, locator: str) -> None:
        try:
            self._request(
                "POST", f"{self._ENDPOINT}/delete", json={"urls": [locator]}
            )
        except StorageError:
            pass   # 롤백 경로 — 삭제 실패로 원래 오류를 덮지 않는다


# ── Supabase Storage ───────────────────────────────────────────────────────
class SupabaseStorage:
    name = "supabase"

    def __init__(self, url: str, service_key: str, bucket: str = "receipts"):
        if not url or not service_key:
            raise StorageError(
                "RECEIPT_STORAGE=supabase 인데 SUPABASE_URL 또는 "
                "SUPABASE_SERVICE_ROLE_KEY 가 없습니다."
            )
        self.base = url.rstrip("/")
        self.key = service_key
        self.bucket = bucket

    def _client(self):
        import httpx

        return httpx.Client(
            timeout=30.0,
            headers={
                "authorization": f"Bearer {self.key}",
                "apikey": self.key,
            },
        )

    def save(self, stored_filename: str, data: bytes, content_type: str) -> str:
        path = f"{self.bucket}/{stored_filename}"
        with self._client() as client:
            res = client.post(
                f"{self.base}/storage/v1/object/{quote(path)}",
                content=data,
                headers={"content-type": content_type or "application/octet-stream"},
            )
        if res.status_code >= 400:
            raise StorageError(f"Supabase Storage 업로드 실패 ({res.status_code}): {res.text[:200]}")
        return path

    def read(self, locator: str) -> bytes:
        with self._client() as client:
            res = client.get(f"{self.base}/storage/v1/object/{quote(locator)}")
        if res.status_code >= 400:
            raise StorageError(f"Supabase Storage 조회 실패 ({res.status_code})")
        return res.content

    def delete(self, locator: str) -> None:
        try:
            with self._client() as client:
                client.delete(f"{self.base}/storage/v1/object/{quote(locator)}")
        except Exception:
            pass


def build_storage(upload_dir: Path) -> Storage:
    """RECEIPT_STORAGE 설정에 맞는 저장소를 만든다."""
    kind = os.getenv("RECEIPT_STORAGE", "local").strip().lower()
    if kind in {"", "local", "disk"}:
        return LocalDiskStorage(upload_dir)
    if kind in {"vercel-blob", "vercel", "blob"}:
        return VercelBlobStorage(
            os.getenv("BLOB_READ_WRITE_TOKEN", ""),
            os.getenv("RECEIPT_BLOB_PREFIX", "receipts"),
        )
    if kind == "supabase":
        return SupabaseStorage(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            os.getenv("RECEIPT_BUCKET", "receipts"),
        )
    raise StorageError(f"알 수 없는 RECEIPT_STORAGE 값입니다: {kind}")
