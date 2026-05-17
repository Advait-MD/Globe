from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str

class PreferenceData(BaseModel):
    username: str
    preference: str    