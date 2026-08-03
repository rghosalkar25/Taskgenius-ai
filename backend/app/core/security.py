"""
core/security.py
-----------------
Password hashing + JWT creation/validation for TaskGenius AI auth.

NOTE: SECRET_KEY below is a dev default. Before deploying anywhere real,
set it via an environment variable instead:
    import os
    SECRET_KEY = os.environ.get("TASKGENIUS_SECRET_KEY", "dev-only-fallback")
"""

from datetime import datetime, timedelta
from typing import Optional
import os

import bcrypt
from jose import JWTError, jwt

SECRET_KEY = os.environ.get("TASKGENIUS_SECRET_KEY", "taskgenius-dev-secret-change-me-before-deploying")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days, convenient for a student project


def hash_password(plain_password: str) -> str:
    # bcrypt has a hard 72-byte input limit; truncate defensively.
    pw_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pw_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(pw_bytes, hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
