"""Shared helpers for the benchmarks. Nothing here changes app logic.

- `load_app()`  imports the real backend (server, news, ...) against a throwaway
  SQLite database and a random JWT secret, exactly as the tests do.
- `replay_guardian()` / `replay_nominatim()` swap the two network calls for
  recorded responses (bench/fixtures), so repeated runs never touch the
  Guardian or OpenStreetMap and are deterministic.
- `pct()` / `summarize()`: percentiles use linear interpolation between closest
  ranks (the same definition as numpy.percentile's default).
"""
import json
import os
import platform
import secrets
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path

BENCH = Path(__file__).resolve().parent
ROOT = BENCH.parent
BACKEND = ROOT / "backend"
FIXTURES = BENCH / "fixtures"
RAW = BENCH / "results" / "raw"
RAW.mkdir(parents=True, exist_ok=True)


# --- statistics ---------------------------------------------------------------

def pct(values, p):
    xs = sorted(values)
    if not xs:
        return float("nan")
    k = (len(xs) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def summarize(values):
    return {"n": len(values), "p50": pct(values, 50), "p95": pct(values, 95),
            "mean": statistics.fmean(values) if values else float("nan"),
            "min": min(values) if values else float("nan"), "max": max(values) if values else float("nan")}


def median_of_runs(runs, key):
    """runs = list of summarize() dicts; median across runs of one statistic."""
    return statistics.median(r[key] for r in runs)


# --- app under test -----------------------------------------------------------

def load_app(db_path=None):
    """Import the real backend against an isolated database. Call before importing backend modules."""
    if db_path is None:
        db_path = Path(tempfile.mkdtemp(prefix="globe-bench-")) / "bench.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["JWT_SECRET"] = secrets.token_urlsafe(48)
    for k in ("DEMO_USERNAME", "DEMO_PASSWORD"):
        os.environ.pop(k, None)
    if str(BACKEND) not in sys.path:
        sys.path.insert(0, str(BACKEND))
    import database, models, news, server  # noqa: F401  (server creates tables on import)
    return server, news, database, models


def reset_db():
    from database import Base, engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


# --- replayed external services ---------------------------------------------

def load_guardian_fixture(name="guardian_feeds.json"):
    return json.loads((FIXTURES / name).read_text())


def replay_guardian(news, feeds, counter=None):
    """feeds = {section: [guardian result dicts]} -> patch news.fetch_guardian_results."""
    async def fake(section):
        if counter is not None:
            counter["guardian_calls"] = counter.get("guardian_calls", 0) + 1
        return feeds[section]
    news.fetch_guardian_results = fake


def replay_nominatim(news, fixture=None, counter=None):
    """Patch news.geocode with recorded Nominatim answers (same call signature as the app's)."""
    from geopy.exc import GeocoderTimedOut
    from geopy.location import Location

    if fixture is None:
        fixture = json.loads((FIXTURES / "nominatim.json").read_text())

    def fake(name, exactly_one=True, limit=1, **_):
        if counter is not None:
            counter["nominatim_calls"] = counter.get("nominatim_calls", 0) + 1
        rec = fixture.get(name)
        if rec is None:
            raise KeyError(f"no Nominatim fixture for {name!r}; re-run bench/record_nominatim.py")
        if rec.get("error"):
            raise GeocoderTimedOut(rec["error"])
        if not rec["results"]:
            return None
        return [Location(r.get("display_name", ""), (float(r["lat"]), float(r["lon"])), r) for r in rec["results"]]

    news.geocode = fake


# --- environment record ---------------------------------------------------------

def machine_info():
    def sh(cmd):
        try:
            return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=20).stdout.strip()
        except Exception as e:  # pragma: no cover
            return f"n/a ({e})"
    info = {
        "cpu": sh("lscpu | grep 'Model name' | sed 's/.*: *//'"),
        "vcpus": os.cpu_count(),
        "memory": sh("free -h | awk '/Mem:/ {print $2}'"),
        "os": sh(". /etc/os-release && echo $PRETTY_NAME") + " / " + platform.release(),
        "python": platform.python_version(),
        "gpu": "none (headless container; WebGL via SwiftShader software rendering)",
    }
    try:
        import spacy, fastapi, sqlalchemy, bcrypt, geopy  # noqa: E401
        info.update({"spacy": spacy.__version__, "fastapi": fastapi.__version__,
                     "sqlalchemy": sqlalchemy.__version__, "bcrypt": bcrypt.__version__, "geopy": geopy.__version__})
    except Exception:
        pass
    return info


def save_raw(name, data):
    path = RAW / name
    path.write_text(json.dumps(data, indent=2, default=str))
    return path
