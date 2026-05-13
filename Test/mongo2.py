from pymongo import MongoClient
from dotenv import load_dotenv
import os
import certifi

load_dotenv()

uri = os.getenv("MONGO_URI")

client = MongoClient(
    uri,
    tls=True,
    tlsCAFile=certifi.where()
)
db = client["pim_db"]

collection = db["users"]

collection.insert_one({
    "name": "Vettle",
    "skills": ["F1", "Ring-Ding-Ding-Ding"],
    "achievements": ["4 Times F1 World Champion"]
})