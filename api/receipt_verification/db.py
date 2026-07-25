from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Iterator

from .config import ReceiptSettings

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS jaesoo_registered_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    card_company TEXT NOT NULL,
    card_last4 TEXT NOT NULL CHECK(length(card_last4) = 4),
    card_holder_name TEXT NOT NULL,
    relationship_to_student TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_registered_cards_user_active
    ON jaesoo_registered_cards(user_id, is_active);

CREATE TABLE IF NOT EXISTS jaesoo_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    registered_card_id INTEGER NOT NULL REFERENCES jaesoo_registered_cards(id),
    status TEXT NOT NULL,
    verification_result TEXT,
    anomaly_reasons TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jaesoo_receipt_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL REFERENCES jaesoo_claims(id),
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_hash TEXT NOT NULL,
    document_type TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipt_documents_claim
    ON jaesoo_receipt_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_receipt_documents_hash
    ON jaesoo_receipt_documents(file_hash);

CREATE TABLE IF NOT EXISTS jaesoo_receipt_ocr_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL UNIQUE REFERENCES jaesoo_claims(id),
    card_last4 TEXT,
    payment_amount INTEGER,
    payment_date TEXT,
    approval_number TEXT,
    merchant_name TEXT,
    business_number TEXT,
    raw_text TEXT,
    confidence_score REAL NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipt_ocr_approval
    ON jaesoo_receipt_ocr_results(approval_number);

CREATE TABLE IF NOT EXISTS jaesoo_verification_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL UNIQUE REFERENCES jaesoo_claims(id),
    card_last4_match INTEGER NOT NULL,
    payment_amount_valid INTEGER NOT NULL,
    payment_date_valid INTEGER NOT NULL,
    approval_number_valid INTEGER NOT NULL,
    merchant_name_valid INTEGER NOT NULL,
    business_number_valid INTEGER NOT NULL,
    duplicate_transaction_detected INTEGER NOT NULL,
    ocr_confidence_valid INTEGER NOT NULL,
    final_result TEXT NOT NULL,
    anomaly_reasons TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""

POSTGRES_SCHEMA = """
CREATE TABLE IF NOT EXISTS jaesoo_registered_cards (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    card_company TEXT NOT NULL,
    card_last4 VARCHAR(4) NOT NULL CHECK(length(card_last4) = 4),
    card_holder_name TEXT NOT NULL,
    relationship_to_student TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_registered_cards_user_active
    ON jaesoo_registered_cards(user_id, is_active);

CREATE TABLE IF NOT EXISTS jaesoo_claims (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    student_id TEXT NOT NULL,
    registered_card_id BIGINT NOT NULL REFERENCES jaesoo_registered_cards(id),
    status TEXT NOT NULL,
    verification_result TEXT,
    anomaly_reasons TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS jaesoo_receipt_documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id BIGINT NOT NULL REFERENCES jaesoo_claims(id),
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash CHAR(64) NOT NULL,
    document_type TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipt_documents_claim
    ON jaesoo_receipt_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_receipt_documents_hash
    ON jaesoo_receipt_documents(file_hash);

CREATE TABLE IF NOT EXISTS jaesoo_receipt_ocr_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id BIGINT NOT NULL UNIQUE REFERENCES jaesoo_claims(id),
    card_last4 VARCHAR(4),
    payment_amount BIGINT,
    payment_date DATE,
    approval_number TEXT,
    merchant_name TEXT,
    business_number TEXT,
    raw_text TEXT,
    confidence_score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipt_ocr_approval
    ON jaesoo_receipt_ocr_results(approval_number);

CREATE TABLE IF NOT EXISTS jaesoo_verification_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id BIGINT NOT NULL UNIQUE REFERENCES jaesoo_claims(id),
    card_last4_match BOOLEAN NOT NULL,
    payment_amount_valid BOOLEAN NOT NULL,
    payment_date_valid BOOLEAN NOT NULL,
    approval_number_valid BOOLEAN NOT NULL,
    merchant_name_valid BOOLEAN NOT NULL,
    business_number_valid BOOLEAN NOT NULL,
    duplicate_transaction_detected BOOLEAN NOT NULL,
    ocr_confidence_valid BOOLEAN NOT NULL,
    final_result TEXT NOT NULL,
    anomaly_reasons TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
"""


def json_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return [str(item) for item in parsed] if isinstance(parsed, list) else []
    except (TypeError, json.JSONDecodeError):
        return []


class DatabaseSession:
    def __init__(self, connection: Any, dialect: str):
        self.connection = connection
        self.dialect = dialect

    def _sql(self, sql: str) -> str:
        return sql.replace("?", "%s") if self.dialect == "postgres" else sql

    @staticmethod
    def _row(cursor: Any, row: Any) -> dict[str, Any] | None:
        if row is None:
            return None
        if isinstance(row, sqlite3.Row):
            return dict(row)
        if isinstance(row, dict):
            return row
        columns = [
            getattr(column, "name", column[0]) for column in cursor.description
        ]
        return dict(zip(columns, row))

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> Any:
        cursor = self.connection.cursor()
        cursor.execute(self._sql(sql), params)
        return cursor

    def fetch_one(
        self, sql: str, params: tuple[Any, ...] = ()
    ) -> dict[str, Any] | None:
        cursor = self.execute(sql, params)
        return self._row(cursor, cursor.fetchone())

    def fetch_all(
        self, sql: str, params: tuple[Any, ...] = ()
    ) -> list[dict[str, Any]]:
        cursor = self.execute(sql, params)
        return [
            row
            for raw in cursor.fetchall()
            if (row := self._row(cursor, raw)) is not None
        ]

    def insert(self, sql: str, params: tuple[Any, ...]) -> int:
        if self.dialect == "postgres":
            cursor = self.execute(f"{sql} RETURNING id", params)
            return int(cursor.fetchone()[0])
        cursor = self.execute(sql, params)
        return int(cursor.lastrowid)


class Database:
    def __init__(
        self,
        settings: ReceiptSettings,
        postgres_connect: Callable[[], Any] | None = None,
    ):
        self.settings = settings
        self._postgres_connect = postgres_connect
        self.dialect = "postgres" if postgres_connect else "sqlite"
        self._initialized = False
        self._init_lock = Lock()

    def _connect(self) -> Any:
        if self.dialect == "postgres":
            assert self._postgres_connect is not None
            return self._postgres_connect()
        path = Path(self.settings.sqlite_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def ensure_schema(self) -> None:
        if self._initialized:
            return
        with self._init_lock:
            if self._initialized:
                return
            connection = self._connect()
            try:
                if self.dialect == "sqlite":
                    connection.executescript(SQLITE_SCHEMA)
                else:
                    connection.cursor().execute(POSTGRES_SCHEMA)
                connection.commit()
                self._initialized = True
            finally:
                connection.close()

    @contextmanager
    def transaction(self) -> Iterator[DatabaseSession]:
        self.ensure_schema()
        connection = self._connect()
        try:
            yield DatabaseSession(connection, self.dialect)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def fetch_one(
        self, sql: str, params: tuple[Any, ...] = ()
    ) -> dict[str, Any] | None:
        with self.transaction() as session:
            return session.fetch_one(sql, params)

    def fetch_all(
        self, sql: str, params: tuple[Any, ...] = ()
    ) -> list[dict[str, Any]]:
        with self.transaction() as session:
            return session.fetch_all(sql, params)

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        with self.transaction() as session:
            session.execute(sql, params)

    def insert(self, sql: str, params: tuple[Any, ...]) -> int:
        with self.transaction() as session:
            return session.insert(sql, params)
