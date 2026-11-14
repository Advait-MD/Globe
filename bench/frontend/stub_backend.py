"""Stub API for the frontend benchmarks: same routes/shapes as the real backend, but /news
returns N synthetic markers (seeded, uniform over the sphere) so FPS can be measured at
100 / 500 / 1000 markers. Not the app. Set N with POST /__markers {"n": 500}.

Run: python bench/frontend/stub_backend.py --port 8765
"""
import argparse, math, random
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
STATE = {"n": 100}


def markers(n, seed=42):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        lat = math.degrees(math.asin(2 * rnd.random() - 1))   # uniform on the sphere
        lon = rnd.uniform(-180, 180)
        out.append({"id": f"a{i}", "Headline": f"Story {i}", "WebURL": "https://example.com",
                    "Locations": [{"name": f"P{i}", "lat": lat, "lon": lon}]})
    return out


@app.post("/__markers")
def set_markers(body: dict):
    STATE["n"] = int(body["n"])
    return STATE


@app.post("/login")
def login(body: dict):
    return {"access_token": "stub", "token_type": "bearer", "username": body.get("username", "bench"), "hasPreference": True}


@app.get("/preference")
def get_pref():
    return {"preference": "technology"}


@app.post("/preference")
def set_pref(body: dict):
    return {"message": "ok"}


@app.get("/news")
def news():
    return markers(STATE["n"])


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8765)
    uvicorn.run(app, host="127.0.0.1", port=ap.parse_args().port, log_level="warning")
