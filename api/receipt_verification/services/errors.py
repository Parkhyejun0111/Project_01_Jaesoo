class ReceiptVerificationError(Exception):
    status_code = 400


class NotFoundError(ReceiptVerificationError):
    status_code = 404


class ConflictError(ReceiptVerificationError):
    status_code = 409


class InvalidFileError(ReceiptVerificationError):
    status_code = 400


class FileTooLargeError(ReceiptVerificationError):
    status_code = 413


class OCRUnavailableError(ReceiptVerificationError):
    status_code = 503
