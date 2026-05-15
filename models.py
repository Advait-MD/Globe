from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "credentials"
    
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)