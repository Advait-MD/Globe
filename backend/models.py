from sqlalchemy import Column, Float, Integer, String
from database import Base

class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True)
    password = Column(String)
    preference = Column(String)


class GeocodeCache(Base):
    """Place name -> coordinates, kept across restarts.

    A row with lat/lon = NULL records that Nominatim found nothing, so the
    same dead end isn't looked up again at 1 request per second.
    """

    __tablename__ = "geocode_cache"

    name = Column(String, primary_key=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
