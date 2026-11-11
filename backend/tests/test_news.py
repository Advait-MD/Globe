"""Feed caching and persistent geocoding (fix for the slow /news endpoint)."""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import news
from database import SessionLocal
from models import GeocodeCache

PLACES = {"Paris": (48.85, 2.35), "Kenya": (0.17, 37.9), "Lagos": (6.45, 3.39)}


def article(i, text):
    return {"id": f"a{i}", "webTitle": text, "webUrl": f"https://example.com/a{i}", "fields": {"headline": text, "trailText": ""}}


@pytest.fixture
def fakes(monkeypatch):
    """Replace the Guardian, spaCy and Nominatim with counters."""
    calls = SimpleNamespace(guardian=[], geocode=[], fail_guardian=False, fail_geocode=set())

    async def fake_guardian(section):
        calls.guardian.append(section)
        await asyncio.sleep(0.01)  # give concurrent requests a chance to pile up
        if calls.fail_guardian:
            raise HTTPException(status_code=502, detail="Guardian API error")
        return [article(1, "Floods in Paris and Kenya"), article(2, "Paris talks"), article(3, "News from Atlantis")]

    def fake_extract(text):
        return [w for w in ("Paris", "Kenya", "Lagos", "Atlantis") if w in text], set()

    def fake_geocode(name, exactly_one=True, limit=1):
        calls.geocode.append(name)
        if name in calls.fail_geocode:
            raise TimeoutError("nominatim timed out")
        if name not in PLACES:
            return None
        lat, lon = PLACES[name]
        return [SimpleNamespace(latitude=lat, longitude=lon, raw={"class": "boundary", "addresstype": "city", "importance": 0.8})]

    monkeypatch.setattr(news, "fetch_guardian_results", fake_guardian)
    monkeypatch.setattr(news, "extract_entities", fake_extract)
    monkeypatch.setattr(news, "geocode", fake_geocode)
    return calls


def test_feed_shape_and_locations(fakes):
    feed = asyncio.run(news.get_feed("sport"))
    assert [a["id"] for a in feed] == ["a1", "a2", "a3"]
    assert feed[0]["Locations"] == [
        {"name": "Paris", "lat": 48.85, "lon": 2.35},
        {"name": "Kenya", "lat": 0.17, "lon": 37.9},
    ]
    assert feed[2]["Locations"] == []  # Atlantis isn't a real place


def test_each_place_is_geocoded_once_per_build(fakes):
    asyncio.run(news.get_feed("sport"))
    assert sorted(fakes.geocode) == ["Atlantis", "Kenya", "Paris"]  # Paris appears twice, looked up once


def test_feed_is_cached_per_section(fakes):
    asyncio.run(news.get_feed("sport"))
    asyncio.run(news.get_feed("sport"))
    asyncio.run(news.get_feed("technology"))
    assert fakes.guardian == ["sport", "technology"]


def test_feed_is_rebuilt_after_ttl(fakes, monkeypatch):
    monkeypatch.setattr(news, "FEED_TTL_SECONDS", 0)
    asyncio.run(news.get_feed("sport"))
    asyncio.run(news.get_feed("sport"))
    assert fakes.guardian == ["sport", "sport"]


def test_concurrent_requests_build_the_feed_once(fakes):
    async def burst():
        return await asyncio.gather(*(news.get_feed("sport") for _ in range(50)))

    feeds = asyncio.run(burst())
    assert fakes.guardian == ["sport"]
    assert all(f == feeds[0] for f in feeds)


def test_stale_feed_is_served_when_guardian_fails(fakes, monkeypatch):
    first = asyncio.run(news.get_feed("sport"))
    monkeypatch.setattr(news, "FEED_TTL_SECONDS", 0)
    fakes.fail_guardian = True
    assert asyncio.run(news.get_feed("sport")) == first


def test_guardian_failure_without_cache_is_502(fakes):
    fakes.fail_guardian = True
    with pytest.raises(HTTPException) as exc:
        asyncio.run(news.get_feed("sport"))
    assert exc.value.status_code == 502


def test_geocodes_survive_a_restart(fakes):
    asyncio.run(news.get_feed("sport"))
    assert len(fakes.geocode) == 3

    news.clear_feed_cache()  # what a restart / Render spin-down does to memory
    fakes.geocode.clear()
    asyncio.run(news.get_feed("sport"))

    assert fakes.guardian == ["sport", "sport"]  # the feed itself is rebuilt...
    assert fakes.geocode == []                   # ...but no place is geocoded again


def test_not_found_places_are_remembered(fakes):
    asyncio.run(news.get_feed("sport"))
    with SessionLocal() as db:
        row = db.get(GeocodeCache, "Atlantis")
    assert row is not None and row.lat is None and row.lon is None


def test_transient_geocoding_errors_are_not_cached(fakes):
    fakes.fail_geocode = {"Kenya"}
    feed = asyncio.run(news.get_feed("sport"))
    assert [p["name"] for p in feed[0]["Locations"]] == ["Paris"]
    with SessionLocal() as db:
        assert db.get(GeocodeCache, "Kenya") is None

    news.clear_feed_cache()
    fakes.fail_geocode = set()
    fakes.geocode.clear()
    feed = asyncio.run(news.get_feed("sport"))
    assert fakes.geocode == ["Kenya"]  # retried, and only Kenya
    assert [p["name"] for p in feed[0]["Locations"]] == ["Paris", "Kenya"]


def test_users_with_the_same_section_share_one_build(client, make_user, fakes):
    _, _, alice = make_user("alice")
    _, _, bob = make_user("bob")
    for headers in (alice, bob):
        client.post("/preference", json={"preference": "sport"}, headers=headers)

    a = client.get("/news", headers=alice)
    b = client.get("/news", headers=bob)

    assert a.status_code == b.status_code == 200
    assert a.json() == b.json()
    assert fakes.guardian == ["sport"]
