from operator import add
import os
import asyncio
import httpx
import spacy
import bcrypt
from dotenv import load_dotenv
from fastapi import (FastAPI,HTTPException,Depends)
from sqlalchemy.orm import Session
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
from fastapi.middleware.cors import CORSMiddleware
from database import(SessionLocal,engine,Base)
from models import User
from schemas import UserCreate, PreferenceData

load_dotenv()

GUARDIAN_API_KEY = os.getenv("API_KEY")
ENDPOINT_URL = "https://content.guardianapis.com/search"

app = FastAPI(title="Globe News API",description="Interactive globe based news viewing application",version="1.0.0")

#database setup
Base.metadata.create_all(bind=engine)

app.add_middleware(CORSMiddleware,allow_origins=["https://globe-mocha-eta.vercel.app"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"],)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

#nlp and geolocator to extract location name and coordinates from the news headline and trail text
nlp = spacy.load("en_core_web_sm")
geolocator = Nominatim(user_agent="fastapi-news-app")
geocode = RateLimiter(geolocator.geocode,min_delay_seconds=1)

#function to extract location names
def extract_locations(text):

    doc = nlp(text)

    return [
        ent.text
        for ent in doc.ents
        if ent.label_ in ["GPE", "LOC"]
    ]

#function to get lat and long values of locations
async def get_coordinates(location):

    loop = asyncio.get_event_loop()
    try:
        loc = await loop.run_in_executor(None,geocode,location)
        if loc:
            return {"name": location,
                "lat": loc.latitude,
                "lon": loc.longitude
            }

    except Exception:
        return None

    return None

#endpoint to get user specific news from the api
@app.get("/news/{username}", tages=["news"])
async def get_latest_news_with_locations(username: str, db: Session = Depends(get_db)):

    user = db.query(User).filter(
        User.username == username
    ).first()

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Get user preference
    preference = user.preference

    # Guardian API params
    params = {"api-key": GUARDIAN_API_KEY,"page-size": 10,"order-by": "newest","show-fields": "trailText,headline","section": preference}

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
    
    #response parsing
    for item in data.get(
        "response",
        {}
    ).get("results", []):

        text = " ".join([item.get("webTitle", ""),item.get("fields", {}).get("headline",""),item.get("fields", {}).get("trailText","")])
        locations = list(set(extract_locations(text)))
        coords_list = []
     
     #getting coordinates of the locations
        for loc in locations:

            if loc in cache:
                coord = cache[loc]
            else:
                coord = await get_coordinates(loc)
                cache[loc] = coord
            if coord:
                coords_list.append(coord)

        extracted.append({"id": item.get("id"),"Headline": item.get("fields",{}).get("headline"),"WebURL": item.get("webUrl"),"Locations": coords_list})

    return extracted

#user signup with unique username and hashed password
@app.post("/signup",tags=["auth"])
def signup(user: UserCreate,db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(
        User.username == user.username
    ).first()

    if existing_user:
        raise HTTPException(status_code=400,detail="User already exists")
    
    #password hashing
    hashed_password = bcrypt.hashpw( user.password.encode("utf-8"),bcrypt.gensalt())
    
    #commiting new user in db
    new_user = User(username=user.username,password=hashed_password.decode("utf-8"))
    db.add(new_user)
    db.commit()

    return {
        "message": "User created successfully"
    }

#user login using unique username and password
@app.post("/login", tags=["auth"])
def login(user: UserCreate,db: Session = Depends(get_db)):

    db_user = db.query(User).filter(
        User.username == user.username
    ).first()
    
    #user check and password verification
    if not db_user:
        raise HTTPException(status_code=400,detail="User not found")

    valid_password = bcrypt.checkpw(user.password.encode("utf-8"),db_user.password.encode("utf-8"))

    if not valid_password:

        raise HTTPException(status_code=400,detail="Wrong password")

    return {
        "message": "Login successful",
        "hasPreference": bool(db_user.preference)
    }

#endpoint to save user preference for news in db
@app.post("/save-preference")
def save_preference(data: PreferenceData,db: Session = Depends(get_db)):
    # Find user
    user = db.query(User).filter(
     User.username == data.username
    ).first()

    # If user not found
    if not user:
        raise HTTPException(status_code=404,detail="User not found")

    # Save preference
    user.preference = data.preference

    db.commit()

    return {
        "message": "Preference saved successfully"
    }

#terminate user account by deleting user data from db
@app.delete("/delete-account/{username}")

def delete_account(username:str,db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404,detail="User not found")
    db.delete(user) 
    db.commit()
    return{"message": "Account terminated"}

#end point to get user news preference that he selected during signup or save prefrence actions
@app.get("/get-preference/{username}")

def get_preference(
    username:str,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    return{"preference": user.preference}

