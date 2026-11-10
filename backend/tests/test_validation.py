"""Input validation (fix for issue #3)."""
import pytest


@pytest.mark.parametrize(
    "username",
    ["", "ab", "a" * 31, "has space", "semi;colon", "émoji😀"],
    ids=["empty", "too-short", "too-long", "space", "symbol", "non-ascii"],
)
def test_bad_usernames_are_rejected(client, username):
    r = client.post("/signup", json={"username": username, "password": "s3cret-pass"})
    assert r.status_code == 422


@pytest.mark.parametrize(
    "password",
    ["", "abc", "a" * 73, "😀" * 19],  # 19 emoji = 76 bytes but only 19 characters
    ids=["empty", "too-short", "73-bytes", "multibyte-over-72-bytes"],
)
def test_bad_passwords_are_rejected_not_500(client, password):
    r = client.post("/signup", json={"username": "alice", "password": password})
    assert r.status_code == 422


def test_72_byte_password_is_accepted(client):
    r = client.post("/signup", json={"username": "alice", "password": "a" * 72})
    assert r.status_code == 201


def test_overlong_login_password_is_rejected_not_500(client, make_user):
    make_user("alice")
    r = client.post("/login", json={"username": "alice", "password": "a" * 100})
    assert r.status_code == 422


def test_readme_demo_credentials_are_still_valid(client):
    # README advertises test1 / 1234; the new rules must not lock it out.
    assert client.post("/signup", json={"username": "test1", "password": "1234"}).status_code == 201


@pytest.mark.parametrize("preference", ["lol", "", "Sport", "technology; DROP TABLE users"])
def test_unknown_preferences_are_rejected(client, make_user, preference):
    _, _, headers = make_user("alice")
    r = client.post("/preference", json={"preference": preference}, headers=headers)
    assert r.status_code == 422


@pytest.mark.parametrize("preference", ["environment", "sport", "technology"])
def test_known_preferences_are_saved(client, make_user, preference):
    _, _, headers = make_user("alice")
    assert client.post("/preference", json={"preference": preference}, headers=headers).status_code == 200
    assert client.get("/preference", headers=headers).json() == {"preference": preference}
