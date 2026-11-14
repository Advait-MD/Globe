"""Run the real FastAPI app on a real local HTTP server (uvicorn, in a thread),
with the Guardian and Nominatim replayed from fixtures. Used by the backend benchmarks."""
import socket, threading, time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import load_app, replay_guardian, replay_nominatim, load_guardian_fixture  # noqa: E402


class Counters(dict):
    pass


def start(feeds=None, port=None, cors_origin=None):
    import os
    if cors_origin:
        os.environ["CORS_ORIGINS"] = cors_origin
    server_mod, news, database, models = load_app()
    counters = Counters()
    replay_guardian(news, feeds or load_guardian_fixture(), counters)
    replay_nominatim(news, counter=counters)

    # count feed builds (cache misses) and feed requests, without changing behaviour
    orig_build, orig_get = news.build_feed, news.get_feed
    async def build(section):
        counters["builds"] = counters.get("builds", 0) + 1
        return await orig_build(section)
    async def get(section):
        counters["feed_requests"] = counters.get("feed_requests", 0) + 1
        return await orig_get(section)
    news.build_feed, news.get_feed = build, get

    import uvicorn
    if port is None:
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]

    @server_mod.app.get("/__bench/counters")   # bench-only route, added in this process only
    def _counters():
        return dict(counters)

    @server_mod.app.post("/__bench/clear_cache")  # bench-only: start a scenario from a cold feed cache
    def _clear():
        news.clear_feed_cache()
        return {"cleared": True}
    srv = uvicorn.Server(uvicorn.Config(server_mod.app, host="127.0.0.1", port=port, log_level="warning", lifespan="on"))
    threading.Thread(target=srv.run, daemon=True).start()
    while not srv.started:
        time.sleep(0.05)
    return f"http://127.0.0.1:{port}", news, counters, srv
