import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

import news
from database import SessionLocal, engine, Base
from models import User
from schemas import UserCreate, UserLogin, PreferenceData
from auth import (
    create_access_token,
    get_current_user,
    get_db,
    hash_password,
    verify_password,
)

load_dotenv()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the spaCy model at boot rather than on the first /news request.
    try:
        news.get_nlp()
    except Exception:
        logger.exception("Could not load spaCy model; /news will fail until it is installed")
    yield


app = FastAPI(title="Globe News API", description="Interactive globe based news viewing application", version="1.2.0", lifespan=lifespan)

# database setup
Base.metadata.create_all(bind=engine)

# Comma-separated list, e.g. "https://globe-mocha-eta.vercel.app,http://localhost:5173"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "https://globe-mocha-eta.vercel.app").split(",") if o.strip()]

# Auth travels in the Authorization header, not cookies, so credentials mode is off.
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])


def seed_demo_user():
    """Create the public demo account from env vars, if configured.

    users.db is no longer shipped in the repo, so a fresh deploy starts with an
    empty database; this keeps the README's test credentials working.
    """
    username = os.getenv("DEMO_USERNAME")
    password = os.getenv("DEMO_PASSWORD")
    if not (username and password):
        return
    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == username).first() is None:
            db.add(User(username=username, password=hash_password(password), preference=os.getenv("DEMO_PREFERENCE", "technology")))
            db.commit()
    except IntegrityError:  # another worker seeded it first
        db.rollback()
    finally:
        db.close()


seed_demo_user()


# endpoint to get the signed-in user's news, located on the globe
@app.get("/news", tags=["news"])
async def get_latest_news_with_locations(user: User = Depends(get_current_user)):

    if not user.preference:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No news preference set")

    return await news.get_feed(user.preference)


# user signup with unique username and hashed password; returns a token so the
# user can pick a preference straight away
@app.post("/signup", tags=["auth"], status_code=status.HTTP_201_CREATED)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    new_user = User(username=user.username, password=hash_password(user.password))
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:  # lost a race with a simultaneous signup for the same name
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    return {
        "message": "User created successfully",
        "access_token": create_access_token(new_user.username),
        "token_type": "bearer",
    }


# user login; one generic error for unknown user and wrong password so the
# response doesn't reveal which usernames exist
@app.post("/login", tags=["auth"])
def login(user: UserLogin, db: Session = Depends(get_db)):

    db_user = db.query(User).filter(User.username == user.username).first()

    if not verify_password(user.password, db_user.password if db_user else None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    return {
        "message": "Login successful",
        "access_token": create_access_token(db_user.username),
        "token_type": "bearer",
        "username": db_user.username,
        "hasPreference": bool(db_user.preference),
    }


# get the signed-in user's news preference
@app.get("/preference", tags=["profile"])
def get_preference(user: User = Depends(get_current_user)):
    return {"preference": user.preference}


# save the signed-in user's news preference
@app.post("/preference", tags=["profile"])
def save_preference(data: PreferenceData, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # FastAPI caches get_db per request, so `user` already belongs to `db`
    user.preference = data.preference
    db.commit()
    return {"message": "Preference saved successfully"}


# terminate the signed-in user's account
@app.delete("/account", tags=["profile"])
def delete_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(user)
    db.commit()
    return {"message": "Account terminated"}
