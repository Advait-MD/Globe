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


# --- telling real places from look-alikes -----------------------------------
#
# spaCy's small model sometimes tags non-places as places, and Nominatim will
# happily geocode almost any word. Real examples from the live technology feed:
#   "AI"     tagged GPE -> Anguilla (its country code is AI)
#   "Nvidia" tagged GPE -> an office building in Oregon
# The filters below were checked against real Nominatim responses.

# Short all-caps entities are usually acronyms ("AI", "EV", "LA" -> Laos);
# these are the ones that really are places.
REAL_PLACE_ABBREVIATIONS = {"US", "USA", "UK", "UAE", "NYC", "DRC"}


def looks_like_place_name(text: str) -> bool:
    compact = text.replace(".", "").strip()  # "U.S." -> "US"
    if not compact:
        return False
    if compact.isupper() and len(compact) <= 3:
        return compact in REAL_PLACE_ABBREVIATIONS
    return True


def extract_entities(text: str) -> tuple[list[str], set[str]]:
    """Place names (countries, cities, regions) and organisation names in text."""
    places, orgs = [], set()
    for ent in get_nlp()(text).ents:
        if ent.label_ in ("GPE", "LOC") and looks_like_place_name(ent.text):
            places.append(ent.text)
        elif ent.label_ == "ORG":
            orgs.add(ent.text)
    return places, orgs


# Nominatim result classes that are actual places. Companies come back as
# office/shop/building ("Nvidia" -> office, "Amazon" -> building, "Google" -> shop).
PLACE_CLASSES = {"boundary", "place"}

# Tiny places only count if they are notable: "Middle East" -> a neighbourhood
# in Baltimore (importance 0.35), "Trump" -> a hamlet in Ohio (0.13).
MINOR_PLACE_TYPES = {"neighbourhood", "suburb", "quarter", "hamlet", "isolated_dwelling", "farm", "croft", "locality", "city_block", "plot", "square", "allotments"}
MIN_MINOR_IMPORTANCE = 0.4

# Ask for a few candidates and keep the most important real place: Nominatim's
# first answer for "Gaza" is a province of Mozambique (0.48), but Gaza City
# (0.66) is in the top five.
GEOCODE_CANDIDATES = 5


def _importance(raw: dict) -> float:
    try:
        return float(raw.get("importance") or 0)
    except (TypeError, ValueError):
        return 0.0


def is_real_place(raw: dict) -> bool:
    if raw.get("class") not in PLACE_CLASSES:
        return False
    kind = raw.get("addresstype") or raw.get("type")
    if kind in MINOR_PLACE_TYPES and _importance(raw) < MIN_MINOR_IMPORTANCE:
        return False
    return True


def best_place(candidates):
    """The most important candidate that is a real place, or None."""
    places = [c for c in candidates or [] if is_real_place(getattr(c, "raw", {}) or {})]
    return max(places, key=lambda c: _importance(c.raw), default=None)


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
        candidates = await asyncio.to_thread(geocode, name, exactly_one=False, limit=GEOCODE_CANDIDATES)
    except Exception:
        logger.warning("Geocoding failed for %r", name, exc_info=True)
        return _MISSING  # transient (timeout, 429...): don't remember it
    loc = best_place(candidates)
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

    extracted = []
    for item in results:
        fields = item.get("fields", {})
        text = " ".join([item.get("webTitle", ""), fields.get("headline", ""), fields.get("trailText", "")])
        extracted.append((item, *extract_entities(text)))

    # spaCy labels the same name inconsistently ("Nvidia" is ORG in one
    # headline, GPE in the next). If it's an organisation anywhere in this
    # feed, don't put it on the map anywhere.
    organisations = set().union(*(orgs for _, _, orgs in extracted))
    articles = [
        (item, [p for p in dict.fromkeys(places) if p not in organisations])
        for item, places, _ in extracted
    ]

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
