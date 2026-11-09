from typing import Literal

from pydantic import BaseModel, Field, field_validator

# bcrypt only looks at the first 72 bytes of a password, and bcrypt>=5 raises
# ValueError for anything longer. The limit is in bytes, not characters, so a
# password of 30 emoji is already over it.
BCRYPT_MAX_BYTES = 72

NewsSection = Literal["environment", "sport", "technology"]


def _check_password_bytes(value: str) -> str:
    if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError(f"Password must be at most {BCRYPT_MAX_BYTES} bytes")
    return value


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=4, max_length=BCRYPT_MAX_BYTES)

    _password_bytes = field_validator("password")(_check_password_bytes)


class UserLogin(BaseModel):
    # Deliberately looser than UserCreate: login should answer "invalid
    # credentials", not hint at what a valid username looks like.
    username: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=1, max_length=BCRYPT_MAX_BYTES)

    _password_bytes = field_validator("password")(_check_password_bytes)


class PreferenceData(BaseModel):
    preference: NewsSection
