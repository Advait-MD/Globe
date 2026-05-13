import json
import httpx
from dotenv import load_dotenv
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

GUARDIAN_API_KEY = os.getenv("API_KEY")
ENDPOINT_URL = "https://content.guardianapis.com/search"

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
        
        return(response.json())
        #return data.get("response", {}).get("results", [])
