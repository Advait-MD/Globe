import os
import asyncio
import httpx
import spacy
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
from fastapi.middleware.cors import CORSMiddleware

# 🔹 Load env variables
load_dotenv()

# 🔹 FastAPI app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# 🔹 API config
GUARDIAN_API_KEY = os.getenv("API_KEY")
ENDPOINT_URL = "https://content.guardianapis.com/search"

# 🔹 Load NLP model
nlp = spacy.load("en_core_web_sm")

# 🔹 Geocoder setup (Nominatim)
geolocator = Nominatim(user_agent="fastapi-news-app")
geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1)


# 🔹 Extract locations using spaCy
def extract_locations(text):
    doc = nlp(text)
    return [ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC"]]


# 🔹 Async wrapper for geopy (since it's blocking)
async def get_coordinates(location):
    loop = asyncio.get_event_loop()
    try:
        loc = await loop.run_in_executor(None, geocode, location)
        if loc:
            return {
                "name": location,
                "lat": loc.latitude,
                "lon": loc.longitude
            }
    except Exception:
        return None
    return None


# 🔥 Main endpoint
@app.get("/")
async def get_latest_news_with_locations():
    params = {
        "api-key": GUARDIAN_API_KEY,
        "page-size": 10,
        "order-by": "newest",
        "show-fields": "trailText,headline",
        "section": "world"
    }

    # 🔹 Fetch news
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(ENDPOINT_URL, params=params)
        except httpx.RequestError:
            raise HTTPException(status_code=500, detail="Failed to connect to Guardian API")

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Guardian API error")

    data = response.json()

    extracted = []
    cache = {}  # 🔥 Avoid duplicate geocoding calls

    # 🔹 Process each news item
    for item in data.get("response", {}).get("results", []):

        text = " ".join([
            item.get("webTitle", ""),
            item.get("fields", {}).get("headline", ""),
            item.get("fields", {}).get("trailText", "")
        ])

        locations = list(set(extract_locations(text)))

        coords_list = []

        for loc in locations:
            if loc in cache:
                coord = cache[loc]
            else:
                coord = await get_coordinates(loc)
                cache[loc] = coord

            if coord:
                coords_list.append(coord)

        extracted.append({
            "id": item.get("id"),
            "Headline": item.get("fields", {}).get("headline"),
            "WebURL": item.get("webUrl"),
            "Locations": coords_list
        })

    return extracted