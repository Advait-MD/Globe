import os
import secrets
import tempfile

# Configure the app *before* it is imported: database.py and auth.py read these
# at import time. Tests use a throwaway SQLite file unless TEST_DATABASE_URL
# points at a real database (CI runs the suite against PostgreSQL too).
# WARNING: the test database is wiped before every test.
_tmpdir = tempfile.mkdtemp(prefix="globe-tests-")
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", f"sqlite:///{_tmpdir}/test.db")
os.environ["JWT_SECRET"] = secrets.token_urlsafe(48)  # random per run; nothing secret-looking in the repo
os.environ.pop("DEMO_USERNAME", None)
os.environ.pop("DEMO_PASSWORD", None)

import pytest
from fastapi.testclient import TestClient

import news
import server
from database import Base, engine


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    news.clear_feed_cache()
    yield


@pytest.fixture
def client():
    # Not used as a context manager, so the lifespan hook (spaCy warm-up) is skipped.
    return TestClient(server.app)


@pytest.fixture
def make_user(client):
    """Sign a user up and return (username, password, auth headers)."""

    def _make(username="alice", password="s3cret-pass"):
        r = client.post("/signup", json={"username": username, "password": password})
        assert r.status_code == 201, r.text
        return username, password, {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _make
