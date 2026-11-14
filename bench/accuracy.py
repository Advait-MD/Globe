"""Benchmark 3: geolocation accuracy on 50 real headlines, judged against PRODUCTION output.

Input: the live poll logs (each /news response = what users actually saw). The first 50 unique
articles by first-seen time are taken (deterministic). For every placed marker we show the
full Nominatim place name (re-derived with the app's own news.best_place over the recorded
candidates; the script checks the coordinates match production's).

Verdicts: bench/results/accuracy_labels.json holds PROVISIONAL verdicts written by Claude
from the headline + URL only (no article text). Put your own verdict in the `your_verdict`
column of results/accuracy_review.csv (correct / partial / wrong / none-ok / none-missed) and
re-run: your verdicts replace Claude's.

Definitions:
  correct      every marker is at a place the story is actually about or names
  partial      at least one marker right, at least one wrong
  wrong        markers present, none right
  none-ok      no marker, and the headline/story names no specific place
  none-missed  no marker, but the story does name a place
"""
import csv, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RAW, FIXTURES, BENCH, load_app  # noqa: E402

server, news, _, _ = load_app()
fixture = json.loads((FIXTURES / "nominatim.json").read_text())

articles, order = {}, []
for name in ("production_poll_run1.jsonl", "production_poll.jsonl"):
    p = RAW / name
    if not p.exists():
        continue
    for line in p.open():
        r = json.loads(line)
        if r.get("kind") != "news" or r.get("status") != 200:
            continue
        for a in r["articles"]:
            if a["id"] not in articles:
                order.append(a["id"])
            articles[a["id"]] = {**a, "section": r["section"]}      # latest appearance wins
sample = [articles[i] for i in order[:50]]

from geopy.location import Location
def place_name(loc):
    rec = fixture.get(loc["name"])
    if not rec or not rec["results"]:
        return "(not in fixture)", None
    cands = [Location(x.get("display_name", ""), (float(x["lat"]), float(x["lon"])), x) for x in rec["results"]]
    best = news.best_place(cands)
    if best is None:
        return "(no place)", None
    same = abs(best.latitude - loc["lat"]) < 0.01 and abs(best.longitude - loc["lon"]) < 0.01
    return best.raw.get("display_name", ""), same

labels_path = BENCH / "results" / "accuracy_labels.json"
labels = json.loads(labels_path.read_text()) if labels_path.exists() else {}
csv_path = BENCH / "results" / "accuracy_review.csv"
mine = {}
if csv_path.exists():
    for row in csv.DictReader(csv_path.open()):
        if row.get("your_verdict", "").strip():
            mine[row["id"]] = row["your_verdict"].strip()

rows, consistency = [], []
for i, a in enumerate(sample, 1):
    locs = []
    for l in a["Locations"]:
        full, same = place_name(l)
        consistency.append(same)
        locs.append(f"{l['name']} -> {full} ({l['lat']:.2f}, {l['lon']:.2f})")
    lab = labels.get(a["id"], {})
    rows.append({"n": i, "id": a["id"], "section": a["section"], "headline": a["Headline"], "url": a["WebURL"],
                 "markers": len(a["Locations"]), "locations": " | ".join(locs) or "-",
                 "claude_verdict": lab.get("verdict", ""), "claude_note": lab.get("note", ""),
                 "your_verdict": mine.get(a["id"], "")})

with csv_path.open("w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

def verdict(r):
    return r["your_verdict"] or r["claude_verdict"]
n = len(rows)
counts = {}
for r in rows:
    counts[verdict(r) or "unlabelled"] = counts.get(verdict(r) or "unlabelled", 0) + 1
no_loc = sum(1 for r in rows if r["markers"] == 0)
located = n - no_loc
summary = {
    "articles": n, "source": "live production /news output",
    "verdicts_by": "user" if mine and len(mine) == n else ("mixed" if mine else "claude (provisional)"),
    "no_location": no_loc, "no_location_pct": 100 * no_loc / n,
    "located": located,
    "counts": counts,
    "correct_pct_of_all": 100 * counts.get("correct", 0) / n,
    "correct_pct_of_located": 100 * counts.get("correct", 0) / located if located else None,
    "markers_total": sum(r["markers"] for r in rows),
    "fixture_matches_production_coords": f"{sum(1 for c in consistency if c)}/{sum(1 for c in consistency if c is not None)}",
}
print(json.dumps(summary, indent=1))
(RAW / "accuracy_summary.json").write_text(json.dumps(summary, indent=1))
