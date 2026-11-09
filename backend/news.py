"""Build the located news feed for a Guardian section, and cache it.

Every user who picks the same section sees the same stories, so the feed is
built once per section and reused for FEED_TTL_SECONDS. Geocoding results are
stored in the database, so a restart (or Render's free tier waking from sleep)
doesn't repeat the slow 1-request-per-second Nominatim lookups.
"""
import asyncio
import logging
import os
import time
from functools import lru_cache

import httpx
from fastapi import HTTPException, status
from geopy.extra.rate_limiter import RateLimiter
from geopy.geocoders import Nominatim
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models import GeocodeCache

logger = logging.getLogger(__name__)

GUARDIAN_API_KEY = os.getenv("API_KEY")
ENDPOINT_URL = "https://content.guardianapis.com/search"

# 15 minutes keeps the 3 sections well under the Guardian developer key's daily
# quota (3 sections x 96 refreshes = 288 calls/day at most, however many users).
FEED_TTL_SECONDS = int(os.getenv("FEED_TTL_SECONDS", "900"))

# Nominatim's usage policy asks for an identifying User-Agent and at most one
# request per second; generic agents get blocked.
geolocator = Nominatim(user_agent=os.getenv("NOMINATIM_USER_AGENT", "news-globe/1.1 (+https://github.com/Advait-MD/Globe)"))
geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1)

# section -> (built_at, feed)
_feed_cache: dict[str, tuple[float, list]] = {}
_feed_locks: dict[str, asyncio.Lock] = {}


def clear_feed_cache():
    _feed_cache.clear()
    _feed_locks.clear()


@lru_cache(maxsize=1)
def get_nlp():
    import spacy  # imported lazily so the auth/database code can be tested without the model
    return spacy.load("en_core_web_sm")


# function to extract location names (countries, cities, regions)
def extract_locations(text: str) -> list[str]:
    return [ent.text for ent in get_nlp()(text).ents if ent.label_ in ("GPE", "LOC")]


async def fetch_guardian_results(section: str) -> list:
    params = {"api-key": GUARDIAN_API_KEY, "page-size": 10, "order-by": "newest", "show-fields": "trailText,headline", "section": section}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(ENDPOINT_URL, params=params)
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to connect to Guardian API")

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Guardian API error")

    return response.json().get("response", {}).get("results", [])


# --- geocoding with a persistent cache ------------------------------------

_MISSING = object()  # "not looked up yet", as opposed to None = "looked up, not found"


def _load_cached(names: list[str]) -> dict:
    with SessionLocal() as db:
        rows = db.query(GeocodeCache).filter(GeocodeCache.name.in_(names)).all()
    return {r.name: (None if r.lat is None else {"name": r.name, "lat": r.lat, "lon": r.lon}) for r in rows}


def _store_cached(results: dict):
    if not results:
        return
    with SessionLocal() as db:
        for name, coord in results.items():
            db.merge(GeocodeCache(name=name, lat=coord and coord["lat"], lon=coord and coord["lon"]))
        try:
            db.commit()
        except IntegrityError:  # another worker cached the same place first; the cache is best-effort
            db.rollback()


async def _lookup(name: str):
    """Ask Nominatim. Returns coords, None for "no such place", or _MISSING on error."""
    try:
        loc = await asyncio.to_thread(geocode, name)
    except Exception:
        logger.warning("Geocoding failed for %r", name, exc_info=True)
        return _MISSING  # transient (timeout, 429...): don't remember it
    return {"name": name, "lat": loc.latitude, "lon": loc.longitude} if loc else None


async def geocode_all(names: list[str]) -> dict:
    """Coordinates for every name, hitting Nominatim only for names never seen before."""
    known = await asyncio.to_thread(_load_cached, names) if names else {}

    fresh = {}
    for name in names:
        if name in known:
            continue
        # Sequential on purpose: Nominatim allows one request per second, so
        # parallel requests would only be queued by the rate limiter (or banned).
        result = await _lookup(name)
        if result is not _MISSING:
            fresh[name] = result

    await asyncio.to_thread(_store_cached, fresh)
    return {**known, **fresh}


# --- the feed ---------------------------------------------------------------

async def build_feed(section: str) -> list:
    results = await fetch_guardian_results(section)

    articles = []
    for item in results:
        fields = item.get("fields", {})
        text = " ".join([item.get("webTitle", ""), fields.get("headline", ""), fields.get("trailText", "")])
        articles.append((item, list(dict.fromkeys(extract_locations(text)))))

    all_names = list(dict.fromkeys(name for _, names in articles for name in names))
    coords = await geocode_all(all_names)

    return [
        {
            "id": item.get("id"),
            "Headline": item.get("fields", {}).get("headline"),
            "WebURL": item.get("webUrl"),
            "Locations": [coords[n] for n in names if coords.get(n)],
        }
        for item, names in articles
    ]


def _is_fresh(entry) -> bool:
    return entry is not None and time.monotonic() - entry[0] < FEED_TTL_SECONDS


async def get_feed(section: str) -> list:
    entry = _feed_cache.get(section)
    if _is_fresh(entry):
        return entry[1]

    # One rebuild per section at a time: if 50 users arrive together, one of
    # them builds the feed and the other 49 wait for it instead of repeating it.
    lock = _feed_locks.setdefault(section, asyncio.Lock())
    async with lock:
        entry = _feed_cache.get(section)
        if _is_fresh(entry):
            return entry[1]
        try:
            feed = await build_feed(section)
        except HTTPException:
            if entry is not None:
                logger.warning("Guardian unavailable; serving stale %s feed", section)
                return entry[1]
            raise
        _feed_cache[section] = (time.monotonic(), feed)
        return feed
