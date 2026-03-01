import os
import base64
import hashlib
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)
DEFAULT_ENCRYPTION_KEY_SEED = "db-control-center-default-encryption-key"


def _normalize_to_fernet_key(raw_value: str) -> bytes:
    digest = hashlib.sha256(raw_value.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _build_fernet_key() -> bytes:
    raw_key = os.getenv("ENCRYPTION_KEY", "").strip()

    if raw_key:
        try:
            # If key is already valid Fernet format, use as is.
            Fernet(raw_key.encode())
            return raw_key.encode()
        except Exception:
            logger.warning("ENCRYPTION_KEY has invalid format. Normalizing provided value to a Fernet key.")
            return _normalize_to_fernet_key(raw_key)

    # Deterministic fallback key to avoid password re-encryption drift between restarts.
    return _normalize_to_fernet_key(DEFAULT_ENCRYPTION_KEY_SEED)


cipher_suite = Fernet(_build_fernet_key())


def encrypt_password(password: str) -> str:
    return cipher_suite.encrypt(password.encode()).decode()


def decrypt_password(token: str) -> str:
    return cipher_suite.decrypt(token.encode()).decode()
