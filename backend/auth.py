import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(hours=int(os.getenv("JWT_TTL_HOURS", "12")))

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    # Still secure (the key is random and never leaves the process), but every
    # restart signs everyone out. Set JWT_SECRET in production.
    JWT_SECRET = secrets.token_urlsafe(64)
    logger.warning("JWT_SECRET is not set; using a random key. Tokens will not survive a restart.")

# Swagger UI shows an "Authorize" box where a token from /login can be pasted.
bearer_scheme = HTTPBearer(auto_error=False)

# Compared against when a username does not exist, so a failed login costs the
# same bcrypt work either way and response timing doesn't reveal which
# usernames are registered.
_DUMMY_HASH = bcrypt.hashpw(b"timing-equaliser", bcrypt.gensalt())

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str | None) -> bool:
    if hashed is None:
        bcrypt.checkpw(password.encode("utf-8"), _DUMMY_HASH)
        return False
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": username, "iat": now, "exp": now + TOKEN_TTL}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise CREDENTIALS_ERROR
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
    except jwt.PyJWTError:
        raise CREDENTIALS_ERROR

    user = db.query(User).filter(User.username == payload["sub"]).first()
    if user is None:  # account deleted after the token was issued
        raise CREDENTIALS_ERROR
    return user
