import json
import httpx
from dotenv import load_dotenv
import os
from fastapi import FastAPI, HTTPException

load_dotenv()

app = FastAPI()

GUARDIAN_API_KEY = os.getenv("API_KEY")
ENDPOINT_URL = "https://content.guardianapis.com/search"


# 🔹 Existing endpoint (unchanged)
@app.get("/")
async def get_latest_news():
    params = {
        "api-key": GUARDIAN_API_KEY,
        "page-size": 5,
        "order-by": "newest",
        "show-fields": "trailText,headline",
        "section": "world"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(ENDPOINT_URL, params=params)

    data=response.json()
    return (data)

@app.get("/extract")
async def extract_headlines(data):
    extracted = []

    for item in data["response"]["results"]:
        extracted.append({
            "id": item["id"],
            "webTitle": item["webTitle"],
            "headline": item["fields"]["headline"],
            "trailText": item["fields"]["trailText"]
        })

    return extracted