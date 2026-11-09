import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()


def normalize_database_url(url: str) -> str:
    """Point Postgres URLs at the psycopg (v3) driver.

    Hosts such as Render, Neon and Heroku hand out ``postgres://`` URLs, which
    SQLAlchemy no longer accepts, so both spellings are rewritten here.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


# Local development falls back to a SQLite file; production should set
# DATABASE_URL to a managed Postgres instance, because the filesystem on
# Render's free tier is wiped on every deploy and restart.
DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./users.db"))

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
