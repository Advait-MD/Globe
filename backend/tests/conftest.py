import os
import tempfile

# Configure the app *before* it is imported: database.py and auth.py read these
# at import time. Each test run gets its own throwaway SQLite file.
_tmpdir = tempfile.mkdtemp(prefix="globe-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmpdir}/test.db"
os.environ["JWT_SECRET"] = "test-secret-not-for-production-0123456789abcdef"
os.environ.pop("DEMO_USERNAME", None)
os.environ.pop("DEMO_PASSWORD", None)

import pytest
from fastapi.testclient import TestClient

import server
from database import Base, engine


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
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
