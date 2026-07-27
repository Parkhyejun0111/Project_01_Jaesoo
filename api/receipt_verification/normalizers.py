from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any


def normalize_card_last4(value: Any) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits[-4:] if len(digits) >= 4 else None


def normalize_payment_amount(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, (float, Decimal)):
        try:
            return int(Decimal(str(value)))
        except (InvalidOperation, ValueError):
            return None
    cleaned = re.sub(r"[^\d.-]", "", unicodedata.normalize("NFKC", str(value)))
    if not cleaned or cleaned in {"-", ".", "-."}:
        return None
    try:
        return int(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return None


def normalize_payment_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = unicodedata.normalize("NFKC", str(value)).strip()
    text = re.sub(r"\s+", "", text)
    text = text.replace("년", "-").replace("월", "-").replace("일", "")
    text = re.sub(r"[.]", "-", text).strip("-")
    formats = (
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%y-%m-%d",
        "%y/%m/%d",
    )
    for fmt in formats:
        try:
            parsed = datetime.strptime(text, fmt).date()
            if parsed.year < 2000:
                parsed = parsed.replace(year=parsed.year + 100)
            return parsed
        except ValueError:
            continue
    return None


def normalize_approval_number(value: Any) -> str | None:
    if value is None:
        return None
    normalized = unicodedata.normalize("NFKC", str(value))
    result = "".join(char for char in normalized if char.isalnum())
    return result or None


def normalize_business_number(value: Any) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits or None


def normalize_merchant_name(value: Any) -> str | None:
    if value is None:
        return None
    normalized = unicodedata.normalize("NFKC", str(value))
    normalized = "".join(
        char if char.isprintable() else " " for char in normalized
    )
    normalized = re.sub(r"\s+", " ", normalized).strip(" \t\r\n|,;:*#")
    return normalized or None
