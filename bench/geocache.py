"""Benchmark 4: geocoding cache -- % of place lookups served from the geocode DB vs sent to Nominatim.

Replays the real sequence of production feeds (every distinct /news snapshot the poller saw,
in time order; fixtures/guardian_snapshots.json) through the app's own news.build_feed with
ONE persistent geocode DB, starting empty -- i.e. a server that starts cold and then refreshes
whenever the live feed changed. Nominatim answers are replayed from fixtures; we count:
  lookups        = place names handed to news.geocode_all (after the app's own filters)
  nominatim      = names actually sent to (replayed) Nominatim  (cache misses)
  served_from_db = lookups - nominatim
3 runs (deterministic, so they must agree). Text = headline only (see RESULTS.md).
"""
import asyncio, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import FIXTURES, load_app, replay_nominatim, reset_db, save_raw  # noqa: E402

server, news, _, _ = load_app()
snapshots = json.loads((FIXTURES / "guardian_snapshots.json").read_text())

runs = []
for run in range(3):
    reset_db(); news.clear_feed_cache()
    counter = {}
    replay_nominatim(news, counter=counter)
    orig_geo = news.geocode_all
    stats = {"lookups": 0}
    async def geo(names):
        stats["lookups"] += len(names)
        return await orig_geo(names)
    news.geocode_all = geo
    per_refresh = []
    for snap in snapshots:
        async def feed(_section, results=snap["results"]):
            return results
        news.fetch_guardian_results = feed
        before_l, before_n = stats["lookups"], counter.get("nominatim_calls", 0)
        asyncio.run(news.build_feed(snap["section"]))
        per_refresh.append({"section": snap["section"], "lookups": stats["lookups"] - before_l,
                            "nominatim": counter.get("nominatim_calls", 0) - before_n})
    news.geocode_all = orig_geo
    L, N = stats["lookups"], counter.get("nominatim_calls", 0)
    first3 = per_refresh[:3]                       # the cold start: first refresh of each section
    Ls, Ns = L - sum(p["lookups"] for p in first3), N - sum(p["nominatim"] for p in first3)
    runs.append({"refreshes": len(snapshots), "lookups": L, "nominatim": N, "served_from_db": L - N,
                 "hit_pct": 100 * (L - N) / L if L else None,
                 "after_cold_start": {"lookups": Ls, "nominatim": Ns, "hit_pct": 100 * (Ls - Ns) / Ls if Ls else None},
                 "per_refresh": per_refresh})
    print({k: v for k, v in runs[-1].items() if k != "per_refresh"})
save_raw("geocache.json", {"runs": runs})
