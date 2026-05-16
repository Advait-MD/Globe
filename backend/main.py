from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
import bcrypt
from database import SessionLocal, engine
from models import User
from schemas import UserCreate
from database import Base

from fastapi.middleware.cors import CORSMiddleware

Base.metadata.create_all(bind=engine)

start = FastAPI()

# CORS
start.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database dependency
def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()

# SIGNUP
@start.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):

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

# LOGIN
@start.post("/login")
def login(user: UserCreate, db: Session = Depends(get_db)):

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