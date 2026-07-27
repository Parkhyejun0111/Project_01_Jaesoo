from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from ..config import ReceiptSettings
from ..enums import DocumentType
from ..repositories import DocumentRepository
from ..storage import Storage, build_storage
from .errors import FileTooLargeError, InvalidFileError

_ALLOWED_TYPES = {
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".pdf": {"application/pdf"},
}


def _signature_matches(extension: str, first_bytes: bytes) -> bool:
    if extension in {".jpg", ".jpeg"}:
        return first_bytes.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return first_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".pdf":
        return first_bytes.startswith(b"%PDF")
    return False


class DocumentService:
    def __init__(
        self,
        repository: DocumentRepository,
        settings: ReceiptSettings,
        storage: Storage | None = None,
    ):
        self.repository = repository
        self.settings = settings
        # 저장소는 갈아끼울 수 있다 — Vercel Functions 는 요청 간 디스크가 유지되지
        # 않으므로 운영에서는 RECEIPT_STORAGE 로 Blob/Supabase 를 지정한다.
        self.storage = storage or build_storage(settings.upload_dir)

    async def save(
        self,
        claim_id: int,
        upload: UploadFile,
        document_type: DocumentType,
    ) -> tuple[dict, str]:
        raw_filename = upload.filename or ""
        filename = Path(raw_filename.replace("\\", "/")).name
        filename = re.sub(r"[\x00-\x1f\x7f]", "", filename)
        filename = re.sub(
            r"(?<!\d)(?:\d[\s-]?){13,19}(?!\d)",
            "[REDACTED_CARD_NUMBER]",
            filename,
        )
        extension = Path(filename).suffix.lower()
        content_type = (upload.content_type or "").lower()
        if (
            not filename
            or extension not in _ALLOWED_TYPES
            or content_type not in _ALLOWED_TYPES[extension]
        ):
            raise InvalidFileError(
                "JPG, JPEG, PNG 또는 PDF 파일만 업로드할 수 있습니다."
            )

        stored_filename = f"{uuid4().hex}{extension}"
        digest = hashlib.sha256()
        size = 0
        first_bytes = b""
        # 원격 저장소는 스트리밍 PUT 을 쓰기 어려워 버퍼링한다. 상한이 10MB 라
        # 메모리 부담이 없고, 크기 초과는 읽는 도중 즉시 끊는다.
        buffer = bytearray()
        try:
            while chunk := await upload.read(1024 * 1024):
                if not first_bytes:
                    first_bytes = chunk[:16]
                size += len(chunk)
                if size > self.settings.max_upload_size_bytes:
                    raise FileTooLargeError(
                        f"파일은 {self.settings.max_upload_size_mb}MB를 초과할 수 없습니다."
                    )
                digest.update(chunk)
                buffer.extend(chunk)
            if size == 0 or not _signature_matches(extension, first_bytes):
                raise InvalidFileError("파일 내용과 확장자가 일치하지 않습니다.")

            locator = self.storage.save(stored_filename, bytes(buffer), content_type)
            timestamp = datetime.now(UTC).isoformat()
            try:
                document = self.repository.create(
                    {
                        "claim_id": claim_id,
                        "original_filename": filename,
                        "stored_filename": stored_filename,
                        "content_type": content_type,
                        "file_size": size,
                        "file_hash": digest.hexdigest(),
                        "document_type": document_type.value,
                        "uploaded_at": timestamp,
                    }
                )
            except Exception:
                self.storage.delete(locator)
                raise
            return document, locator
        finally:
            await upload.close()

    def read(self, locator: str) -> bytes:
        """저장된 파일 내용 (OCR 처리용)."""
        return self.storage.read(locator)

    def list_for_claim(self, claim_id: int) -> list[dict]:
        return self.repository.list_for_claim(claim_id)
