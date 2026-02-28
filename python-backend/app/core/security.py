import os
import base64
import hashlib
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


def _build_fernet_key() -> bytes:
    raw_key = os.getenv("ENCRYPTION_KEY", "").strip()

    if not raw_key:
        # Deterministic fallback key to avoid password re-encryption drift between restarts.
        raw_key = "db-control-center-default-encryption-key"

    try:
        # If key is already valid Fernet format, use as is.
        Fernet(raw_key.encode())
        return raw_key.encode()
    except Exception:
        pass

    # Normalize arbitrary string to a valid Fernet key format.
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    normalized_key = base64.urlsafe_b64encode(digest)
    logger.warning("ENCRYPTION_KEY is missing/invalid format. Using normalized fallback key.")
    return normalized_key


cipher_suite = Fernet(_build_fernet_key())

def encrypt_password(password: str) -> str:
    return cipher_suite.encrypt(password.encode()).decode()

def decrypt_password(token: str) -> str:
    return cipher_suite.decrypt(token.encode()).decode()
