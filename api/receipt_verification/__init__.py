"""Academy receipt verification backend."""

from .api import create_receipt_router
from .config import ReceiptSettings

__all__ = ["ReceiptSettings", "create_receipt_router"]
