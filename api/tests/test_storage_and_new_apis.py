"""업로드 저장소 교체 + 신규 엔드포인트 회귀 테스트."""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import engine
import main
from receipt_verification import storage as st

client = TestClient(main.app)


# ══════════════════════════════════════════════════════════════════════════
# 저장소 선택 — Vercel Functions 는 요청 간 디스크가 유지되지 않는다
# ══════════════════════════════════════════════════════════════════════════
def test_기본은_로컬디스크(monkeypatch, tmp_path):
    monkeypatch.delenv("RECEIPT_STORAGE", raising=False)
    s = st.build_storage(tmp_path)
    assert isinstance(s, st.LocalDiskStorage)
    assert s.name == "local"


@pytest.mark.parametrize("value", ["local", "disk", "", "LOCAL"])
def test_로컬_별칭(monkeypatch, tmp_path, value):
    monkeypatch.setenv("RECEIPT_STORAGE", value)
    assert isinstance(st.build_storage(tmp_path), st.LocalDiskStorage)


def test_로컬_저장_읽기_삭제(tmp_path):
    s = st.LocalDiskStorage(tmp_path / "uploads")
    locator = s.save("abc.png", b"\x89PNG\r\n\x1a\nrest", "image/png")
    assert Path(locator).exists()
    assert s.read(locator) == b"\x89PNG\r\n\x1a\nrest"
    s.delete(locator)
    assert not Path(locator).exists()
    s.delete(locator)   # 두 번 지워도 예외가 나면 안 된다 (롤백 경로)


def test_로컬_저장시_부분파일이_남지_않는다(tmp_path):
    s = st.LocalDiskStorage(tmp_path / "uploads")
    s.save("x.pdf", b"%PDF-1.4", "application/pdf")
    assert not list((tmp_path / "uploads").glob("*.part"))


@pytest.mark.parametrize("value,cls", [
    ("vercel-blob", st.VercelBlobStorage),
    ("vercel", st.VercelBlobStorage),
    ("blob", st.VercelBlobStorage),
])
def test_vercel_blob_은_토큰이_필요하다(monkeypatch, tmp_path, value, cls):
    monkeypatch.setenv("RECEIPT_STORAGE", value)
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    with pytest.raises(st.StorageError, match="BLOB_READ_WRITE_TOKEN"):
        st.build_storage(tmp_path)

    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test")
    assert isinstance(st.build_storage(tmp_path), cls)


def test_supabase_는_url과_키가_필요하다(monkeypatch, tmp_path):
    monkeypatch.setenv("RECEIPT_STORAGE", "supabase")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    with pytest.raises(st.StorageError, match="SUPABASE_URL"):
        st.build_storage(tmp_path)

    monkeypatch.setenv("SUPABASE_URL", "https://demo.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    s = st.build_storage(tmp_path)
    assert isinstance(s, st.SupabaseStorage)
    assert s.bucket == "receipts"


def test_알수없는_저장소는_명확히_실패한다(monkeypatch, tmp_path):
    monkeypatch.setenv("RECEIPT_STORAGE", "s3")
    with pytest.raises(st.StorageError, match="알 수 없는"):
        st.build_storage(tmp_path)


def test_저장소를_주입하면_그것을_쓴다(tmp_path):
    """DocumentService 가 저장소를 갈아끼울 수 있어야 Vercel 배포가 가능하다."""
    from receipt_verification.config import ReceiptSettings
    from receipt_verification.services.document import DocumentService

    class Recording:
        name = "recording"

        def __init__(self):
            self.saved: list[tuple[str, int]] = []

        def save(self, filename, data, content_type):
            self.saved.append((filename, len(data)))
            return f"memory://{filename}"

        def read(self, locator):
            return b""

        def delete(self, locator):
            pass

    settings = ReceiptSettings(
        environment="test", database_url=None, sqlite_path=tmp_path / "db.sqlite",
        upload_dir=tmp_path / "uploads", ocr_provider="mock",
        ocr_confidence_threshold=0.8, max_upload_size_mb=10,
        max_payment_age_days=365, mock_ocr_endpoint_enabled=True,
    )
    recorder = Recording()
    service = DocumentService(repository=None, settings=settings, storage=recorder)  # type: ignore[arg-type]
    assert service.storage is recorder


# ══════════════════════════════════════════════════════════════════════════
# 청구 목록 — student_id 기준 (user_id 는 별도 정수 컬럼)
# ══════════════════════════════════════════════════════════════════════════
def test_청구목록은_식별자가_필요하다():
    res = client.get("/api/claims")
    assert res.status_code == 422


def test_청구목록_student_id_조회():
    res = client.get("/api/claims", params={"student_id": "stu_없는학생"})
    assert res.status_code == 200
    body = res.json()
    assert body["claims"] == []
    assert body["student_id"] == "stu_없는학생"


def test_청구목록_user_id_조회():
    res = client.get("/api/claims", params={"user_id": 999999})
    assert res.status_code == 200
    assert res.json()["claims"] == []


def test_claims_경로가_claim_id로_잡히지_않는다():
    """/api/claims 가 /api/claims/{claim_id} 에 먹히면 422 대신 다른 오류가 난다."""
    res = client.get("/api/claims", params={"student_id": "stu_x"})
    assert res.status_code == 200


# ══════════════════════════════════════════════════════════════════════════
# 응시과목 선언 (약관 별표6)
# ══════════════════════════════════════════════════════════════════════════
def test_선언은_최소_2과목():
    res = client.post("/api/student/stu_x/declare-subjects", json={"subjects": ["국어"]})
    body = res.json()
    assert body["ok"] is False
    assert "2과목" in body["error"]
    assert set(body["allowed"]) == {"국어", "수학", "영어", "탐구"}


def test_판정대상_밖의_과목은_무시된다():
    res = client.post(
        "/api/student/stu_x/declare-subjects",
        json={"subjects": ["국어", "제2외국어", "한문"]},
    )
    # 국어 하나만 유효 → 2과목 미만으로 거절
    assert res.json()["ok"] is False


def test_선언조합_비중_재정규화():
    """별표6 — 선언한 과목만으로 비중을 재정규화한다."""
    w2 = engine.subject_weights(["국어", "수학"])
    assert sum(w2.values()) == pytest.approx(1.0)
    w4 = engine.subject_weights(["국어", "수학", "영어", "탐구"])
    assert sum(w4.values()) == pytest.approx(1.0)
    assert set(w4) == {"국어", "수학", "영어", "탐구"}


# ══════════════════════════════════════════════════════════════════════════
# 해약환급금 (약관 별표5)
# ══════════════════════════════════════════════════════════════════════════
def test_해약환급표():
    res = client.get("/api/surrender-value", params={"paid_total": 100_000})
    body = res.json()
    assert len(body["table"]) == len(engine.SURRENDER_TABLE)
    rates = [row["rate"] for row in body["table"]]
    assert rates == sorted(rates, reverse=True)      # 시점이 늦을수록 체감
    assert rates[0] == 0.70 and rates[-1] == 0.0


def test_해약환급금_계산():
    res = client.get(
        "/api/surrender-value",
        params={"paid_total": 100_000, "stage": "고3 초 ~ 6월 모평 전"},
    )
    body = res.json()
    assert body["current"]["rate"] == 0.50
    assert body["current"]["refund"] == 50_000


def test_해약환급금_없는_단계():
    res = client.get("/api/surrender-value", params={"paid_total": 100_000, "stage": "없는단계"})
    assert res.json()["current"] is None


def test_무해약환급금형_할인폭():
    body = client.get("/api/surrender-value").json()
    assert tuple(body["no_refund_discount"]) == engine.SURRENDER_NO_REFUND_DISCOUNT
