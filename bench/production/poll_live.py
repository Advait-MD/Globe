"""Poll the LIVE deployment to measure real production latency and collect real output.

Why polling: the server caches each section's feed for 15 min (FEED_TTL_SECONDS=900).
The first /news request for a section after its cache expires is a cache MISS: the
server calls the real Guardian API, runs spaCy and geocodes new places on Nominatim.
Every other request inside the window is a cache HIT. Polling once a minute
(a) keeps the Render free-tier instance awake, so sleep/wake time never pollutes a sample,
(b) yields ~4 misses per section per hour and ~57 hits.

Each request is labelled MISS/HIT by schedule: we are the only regular client of this demo,
so a request is an expected miss iff >= 900 s have passed since the previous miss for
that section (or it is the first request). The analysis script checks that latencies agree.

Writes one JSON line per request to bench/results/raw/production_poll.jsonl.
Usage:  python bench/production/poll_live.py --minutes 120
Creates 3 throwaway accounts (one per section) and deletes them at the end.
"""
import argparse, json, secrets, time
from pathlib import Path

import httpx

BASE = "https://globe-2-i1ty.onrender.com"
SECTIONS = ["technology", "sport", "environment"]
TTL = 900
OUT = Path(__file__).resolve().parents[1] / "results" / "raw" / "production_poll.jsonl"


def timed(client, method, path, **kw):
    t0 = time.perf_counter()
    r = client.request(method, BASE + path, **kw)
    return r, (time.perf_counter() - t0) * 1000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=120)
    ap.add_argument("--interval", type=float, default=60)
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    client = httpx.Client(timeout=180)
    out = open(args.out, "a")
    log = lambda rec: (out.write(json.dumps(rec) + "\n"), out.flush())

    # wake the instance (Render free tier sleeps after 15 min idle); not a latency sample
    r, ms = timed(client, "GET", "/openapi.json")
    log({"t": time.time(), "kind": "wake", "status": r.status_code, "ms": ms})

    accounts = {}

    def ensure_account(section):
        user = f"bench_{section[:4]}_{secrets.token_hex(3)}"
        pw = secrets.token_urlsafe(12)
        r = client.post(BASE + "/signup", json={"username": user, "password": pw})
        tok = r.json()["access_token"]
        client.post(BASE + "/preference", json={"preference": section}, headers={"Authorization": f"Bearer {tok}"})
        accounts[section] = (user, pw, tok)

    for s in SECTIONS:
        ensure_account(s)

    last_miss = {s: None for s in SECTIONS}
    end = time.time() + args.minutes * 60
    loop = 0
    try:
        while time.time() < end:
            t_loop = time.time()
            # The connection idles ~60 s between loops and gets closed; re-open it with a cheap
            # request first so no /news sample pays TLS set-up (found in run 1: +~300 ms).
            r, ms = timed(client, "GET", "/openapi.json")
            log({"t": time.time(), "kind": "conn_warmup", "status": r.status_code, "ms": ms})
            for s in SECTIONS:
                now = time.time()
                expected = "MISS" if last_miss[s] is None or now - last_miss[s] >= TTL else "HIT"
                r, ms = timed(client, "GET", "/news", headers={"Authorization": f"Bearer {accounts[s][2]}"})
                if r.status_code == 401:  # server restarted -> SQLite wiped -> account gone
                    log({"t": now, "kind": "restart_detected", "section": s})
                    ensure_account(s)
                    last_miss = {x: None for x in SECTIONS}
                    continue
                if expected == "MISS":
                    last_miss[s] = now
                body = r.json() if r.status_code == 200 else r.text[:300]
                log({"t": now, "kind": "news", "section": s, "expected": expected, "status": r.status_code, "ms": ms,
                     "articles": body if r.status_code == 200 else None, "error": None if r.status_code == 200 else body})
            r, ms = timed(client, "GET", "/openapi.json")
            log({"t": time.time(), "kind": "baseline_openapi", "status": r.status_code, "ms": ms})
            if loop % 5 == 0:
                r, ms = timed(client, "POST", "/login", json={"username": "test1", "password": "1234"})
                log({"t": time.time(), "kind": "login", "status": r.status_code, "ms": ms})
            loop += 1
            time.sleep(max(0, args.interval - (time.time() - t_loop)))
    finally:
        for s, (user, pw, tok) in accounts.items():
            r = client.delete(BASE + "/account", headers={"Authorization": f"Bearer {tok}"})
            log({"t": time.time(), "kind": "cleanup", "user": user, "status": r.status_code})
        out.close()


if __name__ == "__main__":
    main()
