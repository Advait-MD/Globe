"""Signup, login and token checks (fixes for issues #1 and #4)."""
import secrets
from datetime import datetime, timedelta, timezone

import jwt
import pytest

import auth
from database import SessionLocal
from models import User


def test_signup_returns_a_working_token(client):
    r = client.post("/signup", json={"username": "alice", "password": "s3cret-pass"})
    assert r.status_code == 201
    token = r.json()["access_token"]
    me = client.get("/preference", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json() == {"preference": None}


def test_password_is_stored_as_bcrypt_hash(make_user):
    make_user("alice", "s3cret-pass")
    with SessionLocal() as db:
        stored = db.query(User).filter_by(username="alice").one().password
    assert stored != "s3cret-pass"
    assert stored.startswith("$2b$")


def test_duplicate_signup_is_rejected(client, make_user):
    make_user("alice")
    r = client.post("/signup", json={"username": "alice", "password": "another-one"})
    assert r.status_code == 409


def test_login_returns_token_and_preference_flag(client, make_user):
    make_user("alice", "s3cret-pass")
    r = client.post("/login", json={"username": "alice", "password": "s3cret-pass"})
    assert r.status_code == 200
    body = r.json()
    assert body["hasPreference"] is False
    assert body["username"] == "alice"
    assert jwt.decode(body["access_token"], auth.JWT_SECRET, algorithms=["HS256"])["sub"] == "alice"


def test_wrong_password_and_unknown_user_look_identical(client, make_user):
    make_user("alice", "s3cret-pass")
    wrong_pw = client.post("/login", json={"username": "alice", "password": "nope"})
    no_user = client.post("/login", json={"username": "mallory", "password": "nope"})
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json() == {"detail": "Invalid username or password"}


PROTECTED = [("get", "/preference"), ("post", "/preference"), ("delete", "/account"), ("get", "/news")]


@pytest.mark.parametrize("method,path", PROTECTED)
def test_protected_routes_reject_missing_token(client, method, path):
    r = client.request(method.upper(), path, json={"preference": "sport"})
    assert r.status_code == 401


def _forge(sub="alice", secret=None, exp_delta=timedelta(hours=1)):
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": sub, "iat": now, "exp": now + exp_delta}, secret or auth.JWT_SECRET, algorithm="HS256")


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        _forge(secret=secrets.token_urlsafe(48)),              # signed with the wrong key
        _forge(exp_delta=timedelta(seconds=-1)),              # expired
        jwt.encode({"sub": "alice"}, auth.JWT_SECRET, algorithm="HS256"),  # no exp claim
    ],
    ids=["garbage", "wrong-signature", "expired", "no-expiry"],
)
def test_bad_tokens_are_rejected(client, make_user, token):
    make_user("alice")
    r = client.get("/preference", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_unsigned_alg_none_token_is_rejected(client, make_user):
    make_user("alice")
    token = jwt.encode({"sub": "alice", "exp": 9999999999}, None, algorithm="none")
    r = client.get("/preference", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_token_stops_working_after_account_deletion(client, make_user):
    _, _, headers = make_user("alice")
    assert client.delete("/account", headers=headers).status_code == 200
    assert client.get("/preference", headers=headers).status_code == 401
