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

    # v2: results are now filtered to real places (see news.is_real_place), so
    # entries cached under the old rules (e.g. "AI" -> Anguilla) aren't reused.
    __tablename__ = "geocode_cache_v2"

    name = Column(String, primary_key=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
