import json
from pydoc import text
import httpx
from dotenv import load_dotenv
import os
import spacy
from fastapi import FastAPI, HTTPException

load_dotenv()

app = FastAPI()

GUARDIAN_API_KEY = os.getenv("API_KEY")
ENDPOINT_URL = "https://content.guardianapis.com/search"

nlp = spacy.load("en_core_web_sm")

def extract_locations(text):
    doc = nlp(text)
    return [ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC"]]


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
    
    extracted = []

    for item in data["response"]["results"]:
        text=(
            item["webTitle"] + " " +
            item["fields"]["headline"] + " " +
            item["fields"]["trailText"]
        )

        locations = extract_locations(text)

        extracted.append({
            "id": item["id"],
            "locations": list(set(locations))  # remove duplicates
        })

    return extracted