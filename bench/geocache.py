"""Benchmark 4: geocoding cache -- % of place lookups served from the geocode DB vs sent to Nominatim.

Replays the REAL rebuild timeline of the live deployment: every /news cache miss the
production poller observed (latency > 600 ms, same classification and exclusions as
production/analyze_production.py), in time order, each with the articles production
returned at that moment. Each one is fed through the app's own news.build_feed with ONE
persistent geocode DB that starts empty -- i.e. a server that starts cold and then rebuilds
each section every 15 minutes, exactly as production did during the poll window.

Nominatim answers are replayed from fixtures; we count:
  lookups        = place names handed to news.geocode_all (after the app's own filters)
  nominatim      = names actually sent to (replayed) Nominatim   (cache misses)
  served_from_db = lookups - nominatim
"after_cold_start" excludes each section's first rebuild (the unavoidable cold fill).
3 runs (deterministic, so they must agree). Text = headline only (see RESULTS.md).

Caveat that belongs next to this number: on Render's free tier the disk is ephemeral, so a
restart empties the SQLite geocode table; the hit rate holds between restarts (or always,
with DATABASE_URL pointing at Postgres).
"""
import asyncio, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RAW, load_app, replay_nominatim, reset_db, save_raw  # noqa: E402

MISS_MS = 600


def rebuild_timeline():
    rows = []
    for name, drop_tech in (("production_poll_run1.jsonl", True), ("production_poll.jsonl", False)):
        p = RAW / name
        if p.exists():
            rows += [r for r in map(json.loads, p.open())
                     if r.get("kind") == "news" and r.get("status") == 200 and r["ms"] > MISS_MS
                     and not (drop_tech and r["section"] == "technology")]
    rows.sort(key=lambda r: r["t"])
    return [{"t": r["t"], "section": r["section"],
             "results": [{"id": a["id"], "webTitle": a["Headline"] or "", "webUrl": a["WebURL"],
                          "fields": {"headline": a["Headline"] or "", "trailText": ""}} for a in r["articles"]]}
            for r in rows]


server, news, _, _ = load_app()
timeline = rebuild_timeline()

runs = []
for run in range(3):
    reset_db(); news.clear_feed_cache()
    counter = {}
    replay_nominatim(news, counter=counter)
    orig_geo = news.geocode_all
    stats = {"lookups": 0}

    async def geo(names, _orig=orig_geo):
        stats["lookups"] += len(names)
        return await _orig(names)
    news.geocode_all = geo
    per_rebuild, seen_sections = [], set()
    for snap in timeline:
        async def feed(_section, results=snap["results"]):
            return results
        news.fetch_guardian_results = feed
        before_l, before_n = stats["lookups"], counter.get("nominatim_calls", 0)
        asyncio.run(news.build_feed(snap["section"]))
        per_rebuild.append({"section": snap["section"], "first_for_section": snap["section"] not in seen_sections,
                            "lookups": stats["lookups"] - before_l, "nominatim": counter.get("nominatim_calls", 0) - before_n})
        seen_sections.add(snap["section"])
    news.geocode_all = orig_geo
    L, N = stats["lookups"], counter.get("nominatim_calls", 0)
    warm = [p for p in per_rebuild if not p["first_for_section"]]
    Ls, Ns = sum(p["lookups"] for p in warm), sum(p["nominatim"] for p in warm)
    runs.append({"rebuilds": len(timeline), "lookups": L, "nominatim": N, "served_from_db": L - N,
                 "hit_pct": 100 * (L - N) / L if L else None,
                 "after_cold_start": {"rebuilds": len(warm), "lookups": Ls, "nominatim": Ns,
                                      "hit_pct": 100 * (Ls - Ns) / Ls if Ls else None},
                 "per_rebuild": per_rebuild})
    print({k: v for k, v in runs[-1].items() if k != "per_rebuild"})
save_raw("geocache.json", {"source": "production rebuild timeline (cache misses seen by the poller)", "runs": runs})
