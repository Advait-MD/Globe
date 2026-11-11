"""Keeping non-places off the globe ("AI" -> Anguilla, "Nvidia" -> an office in Oregon).

The Nominatim fixtures below are trimmed copies of real responses from
nominatim.openstreetmap.org, recorded while building this fix.
"""
import asyncio
from types import SimpleNamespace

import pytest

import news


def candidate(cls, addresstype, importance, lat, lon, label):
    return SimpleNamespace(
        latitude=lat, longitude=lon,
        raw={"class": cls, "addresstype": addresstype, "importance": importance, "display_name": label},
    )


# Real top-5 Nominatim results (trimmed)
NOMINATIM = {
    "AI": [candidate("boundary", "country", 0.64, 18.2, -63.1, "Anguilla")],
    "Nvidia": [candidate("office", "office", 0.61, 45.5, -122.9, "nVidia, Northeast Walker Road, Hillsboro")],
    "Amazon": [candidate("building", "building", 0.68, 32.9, -97.3, "Amazon Fulfillment Center AFW1")],
    "Google": [candidate("shop", "shop", 0.45, 42.3, -71.1, "Google Store, Newbury Street, Boston")],
    "Gaza": [
        candidate("boundary", "state", 0.48, -23.0, 33.0, "Gaza, Mozambique"),
        candidate("boundary", "city", 0.66, 31.5, 34.5, "Gaza City, Palestinian Territories"),
        candidate("boundary", "state_district", 0.45, 31.4, 34.4, "Gaza Governorate"),
    ],
    "Middle East": [
        candidate("boundary", "neighbourhood", 0.35, 39.3, -76.6, "Middle East, Baltimore, Maryland"),
        candidate("highway", "residential", 0.05, 32.2, 35.0, "Middle East, Qalqilya"),
    ],
    "Trump": [
        candidate("place", "hamlet", 0.13, 40.9, -81.4, "Trump, Plain Township, Ohio"),
        candidate("building", "building", 0.51, 40.8, -74.0, "Trump Tower, 5th Avenue"),
    ],
    "Washington": [
        candidate("place", "city", 0.81, 38.9, -77.0, "Washington, District of Columbia"),
        candidate("boundary", "state", 0.76, 47.4, -120.5, "Washington, United States"),
    ],
    "Silicon Valley": [candidate("place", "region", 0.16, 37.4, -122.1, "Silicon Valley, Santa Clara County")],
    "Westminster": [candidate("place", "quarter", 0.62, 51.5, -0.1, "Westminster, London")],
    "US": [candidate("boundary", "country", 1.0, 39.8, -100.4, "United States")],
    "Europe": [candidate("place", "continent", 0.88, 51.0, 10.0, "Europe")],
}


# --- name filter -----------------------------------------------------------

@pytest.mark.parametrize("name", ["US", "U.S.", "USA", "UK", "UAE", "NYC", "China", "Silicon Valley", "New York", "Gaza"])
def test_real_place_names_pass(name):
    assert news.looks_like_place_name(name)


@pytest.mark.parametrize("name", ["AI", "A.I.", "EV", "LA", "EU", "ML", "", "  "])
def test_acronyms_are_not_place_names(name):
    assert not news.looks_like_place_name(name)


# --- geocoder result filter -----------------------------------------------

@pytest.mark.parametrize("name", ["Nvidia", "Amazon", "Google"])
def test_companies_resolve_to_nothing(name):
    assert news.best_place(NOMINATIM[name]) is None


@pytest.mark.parametrize("name", ["Middle East", "Trump"])
def test_obscure_tiny_places_are_rejected(name):
    assert news.best_place(NOMINATIM[name]) is None


@pytest.mark.parametrize(
    "name,expected",
    [
        ("Gaza", "Gaza City, Palestinian Territories"),     # not the Mozambique province ranked first
        ("Washington", "Washington, District of Columbia"),
        ("Silicon Valley", "Silicon Valley, Santa Clara County"),  # a region, kept despite low importance
        ("Westminster", "Westminster, London"),             # a quarter, but a notable one
        ("US", "United States"),
        ("Europe", "Europe"),
    ],
)
def test_most_important_real_place_wins(name, expected):
    assert news.best_place(NOMINATIM[name]).raw["display_name"] == expected


def test_no_candidates():
    assert news.best_place(None) is None
    assert news.best_place([]) is None


# --- the whole pipeline ------------------------------------------------------

@pytest.fixture
def pipeline(monkeypatch):
    asked = []

    async def fake_guardian(section):
        return [
            {"id": "a1", "webTitle": "", "webUrl": "u1", "fields": {"headline": "The AI poster boy and the US"}},
            {"id": "a2", "webTitle": "", "webUrl": "u2", "fields": {"headline": "Nvidia hires US law firm"}},
            {"id": "a3", "webTitle": "", "webUrl": "u3", "fields": {"headline": "Nvidia sued in Gaza and Middle East"}},
        ]

    # What spaCy actually returned for these headlines: AI and Nvidia tagged
    # as places, Nvidia tagged as ORG once.
    spacy_output = {
        "The AI poster boy and the US": (["AI", "US"], set()),
        "Nvidia hires US law firm": (["US"], {"Nvidia"}),
        "Nvidia sued in Gaza and Middle East": (["Nvidia", "Gaza", "Middle East"], set()),
    }

    def fake_extract(text):
        places, orgs = spacy_output[text.strip()]
        return [p for p in places if news.looks_like_place_name(p)], orgs

    def fake_geocode(name, exactly_one=True, limit=1):
        asked.append(name)
        return NOMINATIM.get(name)

    monkeypatch.setattr(news, "fetch_guardian_results", fake_guardian)
    monkeypatch.setattr(news, "extract_entities", fake_extract)
    monkeypatch.setattr(news, "geocode", fake_geocode)
    return asked


def test_feed_has_no_anguilla_or_office_markers(pipeline):
    feed = asyncio.run(news.get_feed("technology"))
    places = {a["id"]: [l["name"] for l in a["Locations"]] for a in feed}

    assert places == {"a1": ["US"], "a2": ["US"], "a3": ["Gaza"]}
    gaza = feed[2]["Locations"][0]
    assert (round(gaza["lat"]), round(gaza["lon"])) == (32, 34)  # Palestine, not Mozambique (-23, 33)


def test_acronyms_and_organisations_never_reach_the_geocoder(pipeline):
    asyncio.run(news.get_feed("technology"))
    assert "AI" not in pipeline       # dropped by the name filter
    assert "Nvidia" not in pipeline   # tagged ORG elsewhere in the feed
    assert news.GEOCODE_CANDIDATES >= 3


def test_real_spacy_model_on_live_headlines():
    """The headlines that produced the Anguilla and Oregon markers on the live site."""
    try:
        news.get_nlp()
    except OSError:
        pytest.skip("spaCy model en_core_web_sm not installed")

    places, _ = news.extract_entities("The AI poster boy, the ‘Chinese spy’ and Trump: how an affair may have shaken Nvidia’s US standing")
    assert "AI" not in places
    places, _ = news.extract_entities("The French fridge hacks were relatively unsophisticated. An AI-enabled attack would raise the stakes")
    assert "AI" not in places
    places, orgs = news.extract_entities("Nvidia hires leading US law firm to investigate Jensen Huang’s relationship")
    assert "US" in places and "Nvidia" in orgs
