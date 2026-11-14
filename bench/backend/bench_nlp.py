"""Benchmark 2: the NLP pipeline.

- Model load: spacy.load("en_core_web_sm") in 3 fresh processes (what server start-up pays).
- NER per headline: news.extract_entities(text) on every fixture article, text composed
  exactly as news.build_feed does (webTitle + headline + trailText; trailText is empty in
  these fixtures -- see RESULTS.md). 3 runs over all articles, model already loaded.
- Pipeline per refresh: news.build_feed(section) with Guardian + Nominatim replayed and the
  geocode DB warm, timed in total and split into NER vs geocode-lookup time. 3 runs x 3 sections.
"""
import asyncio, statistics, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import load_app, replay_guardian, replay_nominatim, load_guardian_fixture, summarize, save_raw, BACKEND  # noqa: E402

RUNS = 3

# --- model load (fresh process each time) ------------------------------------------
load_ms = []
for _ in range(RUNS):
    out = subprocess.run([sys.executable, "-c",
        "import time,spacy; t=time.perf_counter(); spacy.load('en_core_web_sm'); print((time.perf_counter()-t)*1000)"],
        capture_output=True, text=True, check=True)
    load_ms.append(float(out.stdout.strip().splitlines()[-1]))
print("model load ms:", [round(x) for x in load_ms])

server, news, _, _ = load_app()
feeds = load_guardian_fixture()
replay_guardian(news, feeds)
replay_nominatim(news)
news.get_nlp()

def text_of(item):
    f = item.get("fields", {})
    return " ".join([item.get("webTitle", ""), f.get("headline", ""), f.get("trailText", "")])

texts = [text_of(i) for s in feeds.values() for i in s]

# --- NER per headline ------------------------------------------------------------------
ner_runs = []
for _ in range(RUNS):
    per = []
    for t in texts:
        t0 = time.perf_counter()
        news.extract_entities(t)
        per.append((time.perf_counter() - t0) * 1000)
    ner_runs.append(summarize(per))
print("NER per headline p50/p95 ms:", [(round(r["p50"], 2), round(r["p95"], 2)) for r in ner_runs])

# --- pipeline per refresh, with a breakdown -----------------------------------------
timing = {"ner": 0.0, "geo": 0.0}
orig_extract, orig_geo = news.extract_entities, news.geocode_all
def extract(t):
    t0 = time.perf_counter(); r = orig_extract(t); timing["ner"] += (time.perf_counter() - t0) * 1000; return r
async def geo(names):
    t0 = time.perf_counter(); r = await orig_geo(names); timing["geo"] += (time.perf_counter() - t0) * 1000; return r
news.extract_entities, news.geocode_all = extract, geo

for s in feeds:                      # warm the geocode DB (steady state)
    asyncio.run(news.build_feed(s))

refresh_runs = []
for _ in range(RUNS):
    totals, ners, geos, articles, located = [], [], [], [], []
    for s in feeds:
        timing.update(ner=0.0, geo=0.0)
        t0 = time.perf_counter()
        feed = asyncio.run(news.build_feed(s))
        totals.append((time.perf_counter() - t0) * 1000)
        ners.append(timing["ner"]); geos.append(timing["geo"])
        articles.append(len(feed)); located.append(sum(1 for a in feed if a["Locations"]))
    refresh_runs.append({"total": summarize(totals), "ner": summarize(ners), "geo": summarize(geos),
                         "articles_per_refresh": articles, "articles_with_location": located})
print("refresh total p50 ms per run:", [round(r["total"]["p50"], 1) for r in refresh_runs])

med = {
    "model_load_ms_median": statistics.median(load_ms),
    "ner_per_headline_p50_ms": statistics.median(r["p50"] for r in ner_runs),
    "ner_per_headline_p95_ms": statistics.median(r["p95"] for r in ner_runs),
    "refresh_total_p50_ms": statistics.median(r["total"]["p50"] for r in refresh_runs),
    "refresh_ner_p50_ms": statistics.median(r["ner"]["p50"] for r in refresh_runs),
    "refresh_geocode_lookup_p50_ms": statistics.median(r["geo"]["p50"] for r in refresh_runs),
    "articles_per_refresh": refresh_runs[0]["articles_per_refresh"],
    "headline_chars_median": statistics.median(len(t) for t in texts),
}
print("MEDIAN OF 3 RUNS:", med)
save_raw("nlp_pipeline_local.json", {"model_load_ms": load_ms, "ner_runs": ner_runs, "refresh_runs": refresh_runs,
                                      "median_of_runs": med, "n_texts": len(texts)})
