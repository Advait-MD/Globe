"""Analyse the live-deployment poll logs -> production latency numbers.

Classification: a /news request is a cache MISS if it took > MISS_MS. The threshold sits in
the gap of a clearly bimodal distribution (hits ~tens of ms, misses >= ~1 s; see histogram in
the output). Cross-check: per section, consecutive misses must be one cache TTL apart
(900 s .. 900 + poll interval + slack), which the script verifies and reports.

Run 1 (production_poll_run1.jsonl) predates the connection warm-up fix: its first request
per loop (always 'technology') paid a TLS handshake, so technology samples from run 1 are
excluded entirely. All other samples are used.
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import RAW, summarize, save_raw  # noqa: E402

MISS_MS, TTL, SLACK = 600, 900, 120


def load(name, drop_tech):
    p = RAW / name
    if not p.exists():
        return []
    rows = [json.loads(l) for l in p.open()]
    for r in rows:
        r["src"] = name
    return [r for r in rows if not (drop_tech and r.get("kind") == "news" and r["section"] == "technology")]


rows = load("production_poll_run1.jsonl", True) + load("production_poll.jsonl", False)
news = [r for r in rows if r["kind"] == "news" and r["status"] == 200]
miss = [r for r in news if r["ms"] > MISS_MS]
hit = [r for r in news if r["ms"] <= MISS_MS]
logins = [r["ms"] for r in rows if r["kind"] == "login" and r["status"] == 200]
baseline = [r["ms"] for r in rows if r["kind"] == "baseline_openapi" and r["status"] == 200]

# TTL cross-check: intervals between consecutive misses of the same section, within one run file
intervals = []
for src in {r["src"] for r in miss}:
    for s in ("technology", "sport", "environment"):
        ts = sorted(r["t"] for r in miss if r["section"] == s and r["src"] == src)
        intervals += [b - a for a, b in zip(ts, ts[1:])]
ok = [i for i in intervals if TTL <= i <= TTL + 60 + SLACK]

hist = {}
for r in news:
    b = "<100" if r["ms"] < 100 else "100-300" if r["ms"] < 300 else "300-600" if r["ms"] < 600 else "600-1000" if r["ms"] < 1000 else ">=1000"
    hist[b] = hist.get(b, 0) + 1

out = {
    "requests": len(news), "errors": sum(1 for r in rows if r["kind"] == "news" and r["status"] != 200),
    "histogram_ms": hist,
    "miss": summarize([r["ms"] for r in miss]), "hit": summarize([r["ms"] for r in hit]),
    "hit_rate_of_this_polling_pattern": len(hit) / len(news) if news else None,
    "network_baseline_openapi": summarize(baseline),
    "login": summarize(logins),
    "ttl_check": {"intervals_s": [round(i) for i in intervals], "within_ttl_window": f"{len(ok)}/{len(intervals)}"},
    "miss_samples": [{"section": r["section"], "ms": round(r["ms"]), "utc": __import__("time").strftime("%H:%M:%S", __import__("time").gmtime(r["t"]))} for r in miss],
}
print(json.dumps({k: v for k, v in out.items() if k != "miss_samples"}, indent=1))
save_raw("production_summary.json", out)
