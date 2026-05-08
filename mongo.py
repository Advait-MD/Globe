import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv("MONGO_URI")

client = MongoClient(uri)

db = client["pim_db"]

collection = db["users"]

collection.insert_one({
    "name": "Advait",
    "skills": ["C++", "ML"]
})

#result = collection.find_one({"name": "Advait"})

#collection.delete_one({"name":"Advait"})