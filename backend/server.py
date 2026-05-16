import os
import asyncio
import httpx
import spacy
import bcrypt

from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    HTTPException,
    Depends
)

from sqlalchemy.orm import Session

from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter

from fastapi.middleware.cors import CORSMiddleware

from database import (
    SessionLocal,
    engine,
    Base
)

from models import User
from schemas import UserCreate


# =========================================
# LOAD ENV
# =========================================

load_dotenv()

GUARDIAN_API_KEY = os.getenv("API_KEY")

ENDPOINT_URL = "https://content.guardianapis.com/search"


# =========================================
# FASTAPI APP
# =========================================

app = FastAPI()


# =========================================
# DATABASE
# =========================================

Base.metadata.create_all(bind=engine)


# =========================================
# CORS
# =========================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# =========================================
# DATABASE SESSION
# =========================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# =========================================
# SPACY NLP
# =========================================

nlp = spacy.load("en_core_web_sm")


# =========================================
# GEOLOCATOR
# =========================================

geolocator = Nominatim(
    user_agent="fastapi-news-app"
)

geocode = RateLimiter(
    geolocator.geocode,
    min_delay_seconds=1
)


# =========================================
# LOCATION EXTRACTION
# =========================================

def extract_locations(text):

    doc = nlp(text)

    return [
        ent.text
        for ent in doc.ents
        if ent.label_ in ["GPE", "LOC"]
    ]


# =========================================
# GET COORDINATES
# =========================================

async def get_coordinates(location):

    loop = asyncio.get_event_loop()

    try:

        loc = await loop.run_in_executor(
            None,
            geocode,
            location
        )

        if loc:

            return {
                "name": location,
                "lat": loc.latitude,
                "lon": loc.longitude
            }

    except Exception:
        return None

    return None


# =========================================
# ROOT ROUTE
# =========================================

@app.get("/")
async def get_latest_news_with_locations():

    params = {
        "api-key": GUARDIAN_API_KEY,
        "page-size": 10,
        "order-by": "newest",
        "show-fields": "trailText,headline",
        "section": "world"
    }

    async with httpx.AsyncClient(
        timeout=10.0
    ) as client:

        try:

            response = await client.get(
                ENDPOINT_URL,
                params=params
            )

        except httpx.RequestError:

            raise HTTPException(
                status_code=500,
                detail="Failed to connect to Guardian API"
            )

    if response.status_code != 200:

        raise HTTPException(
            status_code=500,
            detail="Guardian API error"
        )

    data = response.json()

    extracted = []

    cache = {}

    for item in data.get(
        "response",
        {}
    ).get("results", []):

        text = " ".join([

            item.get("webTitle", ""),

            item.get("fields", {}).get(
                "headline",
                ""
            ),

            item.get("fields", {}).get(
                "trailText",
                ""
            )
        ])

        locations = list(
            set(extract_locations(text))
        )

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

            "Headline": item.get(
                "fields",
                {}
            ).get("headline"),

            "WebURL": item.get("webUrl"),

            "Locations": coords_list
        })

    return extracted


# =========================================
# SIGNUP
# =========================================

@app.post("/signup")
def signup(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.username == user.username
    ).first()

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="User already exists"
        )

    hashed_password = bcrypt.hashpw(
        user.password.encode("utf-8"),
        bcrypt.gensalt()
    )

    new_user = User(
        username=user.username,
        password=hashed_password.decode("utf-8")
    )

    db.add(new_user)

    db.commit()

    return {
        "message": "User created successfully"
    }


# =========================================
# LOGIN
# =========================================

@app.post("/login")
def login(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    db_user = db.query(User).filter(
        User.username == user.username
    ).first()

    if not db_user:

        raise HTTPException(
            status_code=400,
            detail="User not found"
        )

    valid_password = bcrypt.checkpw(
        user.password.encode("utf-8"),
        db_user.password.encode("utf-8")
    )

    if not valid_password:

        raise HTTPException(
            status_code=400,
            detail="Wrong password"
        )

    return {
        "message": "Login successful"
    }