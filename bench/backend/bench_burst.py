"""Scenario C: 50 concurrent GET /news for one section immediately after its cache expired.
Measures how many feed builds happen (the per-section asyncio.Lock should make it exactly 1).
3 runs."""
import asyncio, sys, time
from pathlib import Path
import httpx
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import save_raw  # noqa: E402
from backend.harness import start  # noqa: E402

base, news, counters, srv = start()
async def main():
    async with httpx.AsyncClient(base_url=base, timeout=60) as c:
        tok = (await c.post("/signup", json={"username": "burst", "password": "bench-pass"})).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}
        await c.post("/preference", json={"preference": "technology"}, headers=h)
        await c.get("/news", headers=h)                       # warm geocode DB
        runs = []
        for _ in range(3):
            news.clear_feed_cache(); b0, r0 = counters.get("builds", 0), counters.get("feed_requests", 0)
            t0 = time.perf_counter()
            rs = await asyncio.gather(*(c.get("/news", headers=h) for _ in range(50)))
            wall = (time.perf_counter() - t0) * 1000
            assert all(r.status_code == 200 for r in rs)
            runs.append({"requests": counters["feed_requests"] - r0, "builds": counters["builds"] - b0, "wall_ms": wall})
            print(runs[-1])
        return runs
runs = asyncio.run(main())
save_raw("cache_burst.json", {"runs": runs})
srv.should_exit = True
