"""Benchmark 1: GET /news latency, cache MISS (cold) vs cache HIT (warm), on a local server.

Cold = feed cache cleared before each request (news.clear_feed_cache()), so the server
rebuilds the feed: Guardian call (replayed, ~0 ms), spaCy NER on every article, geocode
lookups (served from the geocode DB, which is warmed first -- the steady state in
production, where place coordinates persist). Real Guardian/Nominatim network time is
NOT in these numbers; the production poller measures that end to end.
Warm = feed served from the in-memory cache.

3 runs x (30 cold + 300 warm) requests, sequential, one HTTP keep-alive client.
"""
import json, statistics, sys, time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import summarize, save_raw, machine_info  # noqa: E402
from backend.harness import start  # noqa: E402

RUNS, COLD_N, WARM_N = 3, 30, 300
SECTIONS = ["technology", "sport", "environment"]

base, news, counters, srv = start()
c = httpx.Client(base_url=base, timeout=60)
tokens = {}
for s in SECTIONS:
    tok = c.post("/signup", json={"username": f"bench_{s}", "password": "bench-pass"}).json()["access_token"]
    c.post("/preference", json={"preference": s}, headers={"Authorization": f"Bearer {tok}"})
    tokens[s] = {"Authorization": f"Bearer {tok}"}
    c.get("/news", headers=tokens[s])            # warm the geocode DB + spaCy model

def timed_get(headers):
    t0 = time.perf_counter()
    r = c.get("/news", headers=headers)
    ms = (time.perf_counter() - t0) * 1000
    assert r.status_code == 200 and len(r.json()) == 10, r.text[:200]
    return ms

runs = []
for run in range(RUNS):
    cold, warm = [], []
    for i in range(COLD_N):
        news.clear_feed_cache()
        cold.append(timed_get(tokens[SECTIONS[i % 3]]))
    for i in range(WARM_N):
        warm.append(timed_get(tokens[SECTIONS[i % 3]]))
    runs.append({"cold": summarize(cold), "warm": summarize(warm), "cold_ms": cold, "warm_ms": warm})
    print(f"run {run+1}: cold p50 {runs[-1]['cold']['p50']:.1f} p95 {runs[-1]['cold']['p95']:.1f} | "
          f"warm p50 {runs[-1]['warm']['p50']:.2f} p95 {runs[-1]['warm']['p95']:.2f} ms")

med = {k: {s: statistics.median(r[k][s] for r in runs) for s in ("p50", "p95")} for k in ("cold", "warm")}
print("MEDIAN OF 3 RUNS:", json.dumps(med))
save_raw("news_latency_local.json", {"machine": machine_info(), "runs": runs, "median_of_runs": med,
                                      "counters": dict(counters)})
srv.should_exit = True
