"""Database configuration and demo seeding (fix for issue #2)."""
import subprocess
from pathlib import Path

import pytest

import server
from database import SessionLocal, normalize_database_url
from models import User

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize(
    "given,expected",
    [
        ("postgres://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        ("postgresql://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("sqlite:///./users.db", "sqlite:///./users.db"),
    ],
)
def test_database_url_normalisation(given, expected):
    assert normalize_database_url(given) == expected


def test_demo_user_is_seeded_once_and_can_log_in(client, monkeypatch):
    monkeypatch.setenv("DEMO_USERNAME", "test1")
    monkeypatch.setenv("DEMO_PASSWORD", "1234")

    server.seed_demo_user()
    server.seed_demo_user()  # idempotent

    with SessionLocal() as db:
        assert db.query(User).filter_by(username="test1").count() == 1

    r = client.post("/login", json={"username": "test1", "password": "1234"})
    assert r.status_code == 200
    assert r.json()["hasPreference"] is True


def test_no_demo_user_without_env(monkeypatch):
    monkeypatch.delenv("DEMO_USERNAME", raising=False)
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)
    server.seed_demo_user()
    with SessionLocal() as db:
        assert db.query(User).count() == 0


def test_no_sqlite_database_is_tracked_in_git():
    try:
        tracked = subprocess.run(
            ["git", "ls-files", "*.db", "*.sqlite", "*.sqlite3"],
            cwd=REPO_ROOT, capture_output=True, text=True, check=True,
        ).stdout.split()
    except (FileNotFoundError, subprocess.CalledProcessError):
        pytest.skip("not running inside a git checkout")
    assert tracked == []
