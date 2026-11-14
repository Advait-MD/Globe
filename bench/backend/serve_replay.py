"""Serve the real backend on a fixed port with replayed Guardian/Nominatim, for browser-driven
benchmarks. Exposes GET /__bench/counters (feed_requests, builds, guardian_calls, nominatim_calls).
Usage: python bench/backend/serve_replay.py --port 8766 --cors http://localhost:4182"""
import argparse, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.harness import start  # noqa: E402

ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8766); ap.add_argument("--cors", default="http://localhost:4182")
a = ap.parse_args()
base, news, counters, srv = start(port=a.port, cors_origin=a.cors)
print("serving", base, flush=True)
while True:
    time.sleep(3600)
