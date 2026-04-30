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

    return response.json()


# 🔥 New endpoint: extract by ID
@app.get("/extract")
async def extract_news(news_id: str):
    params = {
        "api-key": GUARDIAN_API_KEY,
        "page-size": 5,
        "order-by": "newest",
        "show-fields": "trailText,headline",
        "section": "world"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(ENDPOINT_URL, params=params)

    data = response.json()

    # ⚡ Build index (id → data)
    news_index = {
        item["id"]: {
            "webTitle": item["webTitle"],
            "headline": item["fields"]["headline"],
            "trailText": item["fields"]["trailText"]
        }
        for item in data["response"]["results"]
    }

    # 🔍 Lookup
    result = news_index.get(news_id)

    if not result:
        raise HTTPException(status_code=404, detail="News not found")

    return result