"""Turn real production /news snapshots into Guardian-shaped replay fixtures.

Source: bench/results/raw/production_poll_run1.jsonl + production_poll.jsonl (written by production/poll_live.py).
Why not the Guardian API directly: this session has no Guardian API key and cannot
reach the Guardian (see RESULTS.md, "What could not be measured"). The live backend
calls the real Guardian API, so its /news output carries the real headlines and URLs.

Limitation, stated everywhere it matters: /news returns the headline but not the
Guardian `trailText`, so replayed articles carry headline text only. The app's NER
input is webTitle + headline + trailText; in replays it is webTitle + headline.

Writes:
  fixtures/guardian_feeds.json      latest feed per section  {section: [result, ...]}
  fixtures/guardian_snapshots.json  every distinct feed seen, in time order
                                    [{"t": unix, "section": s, "results": [...]}, ...]
"""
import json
from common import RAW, FIXTURES


def to_guardian(article):
    return {"id": article["id"], "webTitle": article["Headline"] or "", "webUrl": article["WebURL"],
            "fields": {"headline": article["Headline"] or "", "trailText": ""}}


def main():
    snapshots, last_ids = [], {}
    lines = []
    for name in ("production_poll_run1.jsonl", "production_poll.jsonl"):   # run 1 then run 2, time order
        if (RAW / name).exists():
            lines += (RAW / name).read_text().splitlines()
    for line in lines:
        r = json.loads(line)
        if r.get("kind") != "news" or r.get("status") != 200 or not r.get("articles"):
            continue
        ids = [a["id"] for a in r["articles"]]
        if last_ids.get(r["section"]) != ids:
            last_ids[r["section"]] = ids
            snapshots.append({"t": r["t"], "section": r["section"], "results": [to_guardian(a) for a in r["articles"]],
                              "production_locations": {a["id"]: a["Locations"] for a in r["articles"]}})
    latest = {}
    for s in snapshots:
        latest[s["section"]] = s["results"]
    (FIXTURES / "guardian_feeds.json").write_text(json.dumps(latest, indent=1))
    (FIXTURES / "guardian_snapshots.json").write_text(json.dumps(snapshots, indent=1))
    unique = {a["id"] for s in snapshots for a in s["results"]}
    print(f"{len(snapshots)} distinct feed snapshots, {len(unique)} unique articles; latest feeds: "
          + ", ".join(f"{k}={len(v)}" for k, v in latest.items()))


if __name__ == "__main__":
    main()
