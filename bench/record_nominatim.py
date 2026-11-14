"""Record real Nominatim answers ONCE for every place name the app would look up.

Uses the app's own geocoder object (news.geolocator: same User-Agent, same default
timeout) and the app's own parameters (exactly_one=False, limit=news.GEOCODE_CANDIDATES).
Spacing between requests is >= 1.1 s (Nominatim usage policy: max 1 request/second).
Names already in fixtures/nominatim.json are skipped, so re-running only records new names.

Each entry: {"results": [raw Nominatim dicts] | [], "ms": request latency, "error": str|None}
A timeout is recorded as an error, exactly as the app would experience it.
"""
import json, time
from common import FIXTURES, load_app

server, news, _, _ = load_app()

snapshots = json.loads((FIXTURES / "guardian_snapshots.json").read_text())
path = FIXTURES / "nominatim.json"
fixture = json.loads(path.read_text()) if path.exists() else {}

names = []
for snap in snapshots:
    for item in snap["results"]:
        text = " ".join([item.get("webTitle", ""), item["fields"].get("headline", ""), item["fields"].get("trailText", "")])
        places, _orgs = news.extract_entities(text)
        names += places
# also record the names production actually placed (to show their full place names in the accuracy review)
for snap in snapshots:
    for locs in snap.get("production_locations", {}).values():
        names += [l["name"] for l in locs]
todo = [n for n in dict.fromkeys(names) if n not in fixture]
print(f"{len(set(names))} distinct place names, {len(todo)} not yet recorded")

last = 0.0
for i, name in enumerate(todo, 1):
    wait = 1.1 - (time.monotonic() - last)
    if wait > 0:
        time.sleep(wait)
    last = time.monotonic()
    t0 = time.perf_counter()
    try:
        res = news.geolocator.geocode(name, exactly_one=False, limit=news.GEOCODE_CANDIDATES)
        rec = {"results": [r.raw for r in res] if res else [], "error": None}
    except Exception as e:
        rec = {"results": [], "error": f"{type(e).__name__}: {e}"}
    rec["ms"] = (time.perf_counter() - t0) * 1000
    rec["recorded_at"] = time.time()
    fixture[name] = rec
    path.write_text(json.dumps(fixture, indent=1, ensure_ascii=False))
    print(f"{i}/{len(todo)} {name!r}: {len(rec['results'])} results, {rec['ms']:.0f} ms{' ERROR ' + rec['error'] if rec['error'] else ''}")
