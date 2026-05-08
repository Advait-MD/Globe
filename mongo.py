from pymongo import MongoClient

uri = "mongodb+srv://advait-md:NKP76qP8Xe8MWreW@core-cluster0.hh04wn2.mongodb.net/?appName=CORE-Cluster0"

client = MongoClient(uri)

db = client["pim_db"]

collection = db["users"]

collection.insert_one({
    "name": "Advait",
    "skills": ["C++", "ML"]
})

data = collection.find()

collection.update_one(
    {"name": "Advait"},
    {"$set": {"age": 20}}
)

result = collection.find_one({"name": "Advait"})

