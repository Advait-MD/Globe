# News Globe: measured benchmark results

Every number below was **measured** by a script in `bench/`, and its raw output is in `bench/results/raw/`. Nothing here is estimated. Where something could not be measured, the [last section](#what-could-not-be-measured) says so. No app logic was changed: the benchmarks import the real backend and only replace the two external calls (the Guardian and Nominatim) with recorded responses.

Measured on **14 Nov 2026** (a Saturday). Production poll window: 12:41–14:57 UTC.

## Results

**Where** says where each number comes from:
- **prod**: the live Render deployment, timed from this cloud container over the internet.
- **local**: the real backend on this machine, with recorded Guardian and Nominatim responses replayed.
- **CI**: GitHub's own run records.
- **Vercel**: the live frontend.

"Median of 3" means each benchmark ran 3 times and the table shows the median of the 3 results.

### 1. News latency and caching

| Metric | Value | Where | Samples |
|---|---|---|---|
| `/news` **cache hit**, p50 / p95 | **58.3 / 79.2 ms** | prod | 357 requests |
| Network baseline (`/openapi.json`, no app work), p50 / p95 | 54.3 / 70.2 ms | prod | 136 requests |
| `/news` **cache miss** (feed rebuild), p50 / p95 | **1,346 / 5,595 ms** | prod | 25 rebuilds |
| First rebuild after the poll started (includes Nominatim calls) | 6.6 s and 7.8 s | prod | 2 |
| Cache expiry seen in production (gap between rebuilds) | 955–960 s, 20 of 20 gaps within the 900 s TTL window | prod | 20 gaps |
| Hit rate while polling 3 sections once a minute | 93.5% (357 / 382) | prod | 1 run of 2 h 16 min |
| Errors | **0 / 382** | prod | |
| `/news` cold (rebuild every request), p50 / p95 | 49.1 / 54.2 ms | local | median of 3 × 30 |
| `/news` warm (cache hit), p50 / p95 | 2.27 / 2.78 ms | local | median of 3 × 300 |
| Cache hit rate, one user's realistic session (8 requests) | **62.5%** (5 / 8; 3 rebuilds = 3 sections) | local, real UI | 3 of 3 runs identical |
| Cache hit rate, 5 users on the same section (15 requests) | **93.3%** (14 / 15) | local, real UI | 3 of 3 runs identical |
| 50 concurrent requests right after expiry | **1 rebuild** (wall time 302–398 ms) | local | 3 of 3 runs |

### 2. NLP pipeline

| Metric | Value | Where | Samples |
|---|---|---|---|
| Articles per refresh | 10 (Guardian `page-size`) | local | every refresh |
| spaCy NER per headline, p50 / p95 | **4.56 / 5.84 ms** | local | median of 3 × 30 headlines; input = title + headline, no standfirst |
| Full refresh (10 articles: NER, filters, geocode-cache read), p50 | **51.1 ms** (NER 48.8 ms, geocode-cache read 1.35 ms) | local | median of 3 |
| Loading the spaCy model (`en_core_web_sm`, once per process) | 290 ms | local | median of 3 fresh processes |

### 3. Location accuracy

| Metric | Value | Samples |
|---|---|---|
| Headlines checked | **30** (not 50: see [below](#what-could-not-be-measured)) | every unique live headline |
| Placed stories that are correct | **94.1%** (16 / 17) | provisional; you need to check them |
| Headlines with no marker | **43.3%** (13 / 30): 11 name no place, 2 missed a place | provisional |
| Handled correctly overall (right marker, or rightly no marker) | **90.0%** (27 / 30) | provisional |
| Wrong markers | 1 (Newcastle, NSW placed in Newcastle upon Tyne, UK) | |

### 4. Geocoding cache

| Metric | Value | Samples |
|---|---|---|
| Place lookups served from the geocode DB | **89.1%** (115 / 129); only 14 of 129 sent to OpenStreetMap | the 25 real production rebuilds, replayed, 3 of 3 runs identical |
| Served from the DB after each section's first (cold) rebuild | 100% (114 / 114) | best case: the feeds didn't change during the window |

### 5. Frontend

| Metric | Value | Where | Samples |
|---|---|---|---|
| JS bundle (one chunk) | **663.1 KiB** raw / **179.1 KiB** gzip / 150.1 KiB brotli | prod build | |
| Earth texture (`earth.webp`) | 224 KiB | prod build | |
| Live site load: TTFB / FCP / `load` event | 108 / **468** / 349 ms; 194,888 bytes transferred | Vercel | median of 4 (first cold run: FCP 1,124 ms) |
| **Lighthouse performance** (mobile, simulated throttling) | **84** (runs: 84, 88, 84) | Vercel | 3 runs |
| Lighthouse performance on a local preview | 85 (runs: 82, 85, 89); TBT 540 ms; CLS 0 | local | 3 runs |
| FPS at 0 / 20 / 100 / 500 / 1,000 markers | 38.0 / 33.6 / 18.5 / 6.0 / 3.2 | software GPU (SwiftShader) | median of 3 × 10 s; **don't put this on the resume** |

### 6. Auth

| Metric | Value | Where | Samples |
|---|---|---|---|
| **bcrypt cost factor** | **12** (hash prefix `$2b$12$`) | code and stored hash | |
| bcrypt verify, p50 / p95 | 272 / 290 ms | local | median of 3 × 30 |
| `POST /login`, p50 / p95 | **281 / 301 ms** | local | median of 3 × 30 |
| `POST /signup`, p50 / p95 | 281 / 302 ms | local | median of 3 × 30 |
| `POST /login`, p50 / p95 | 1,695 / 1,766 ms | prod (Render free tier, shared CPU) | 28 logins |

### 7. Tests and CI

| Metric | Value | Samples |
|---|---|---|
| Backend tests (pytest) | **91 passed** | |
| Frontend tests (Vitest) | **20 passed** (3 files) | |
| Backend line coverage (test files excluded) | **92%** (308 statements, 25 missed): auth 96, news 91, server 87, others 100 | |
| Frontend line coverage | **24.55%** (branches 81.7%) | weak, so leave it off the resume |
| GitHub Actions run time (whole workflow, jobs in parallel) | **64 s** median (52–70 s) | 11 runs of the current workflow |
| CI pass rate | 13 / 13 runs succeeded | every completed run |

## How to explain each number in an interview

| Number | One line |
|---|---|
| 58 ms cache hit (prod) | "Timed from outside over the internet; the network baseline to the same server is 54 ms, so the cache hit costs the server about 4 ms. The rest is the round trip." |
| 1.3 s cache miss (prod) | "A rebuild is a Guardian API call plus spaCy over 10 headlines on Render's free-tier shared CPU. Caching per section means only one request every 15 minutes pays for it." |
| 5.6 s miss p95 | "The p95 comes from the first rebuild of each section, which also had to geocode new places at Nominatim's one-request-per-second limit." |
| 960 s between rebuilds | "It's my 900 s TTL. The poller runs once a minute, so expiry shows up on the next poll. That's how I confirmed the miss classification wasn't guesswork." |
| 0 / 382 errors | "Two hours sixteen minutes of polling against the live deploy, no failed requests." |
| 49 → 2.3 ms (local) | "Same app with the Guardian and Nominatim replayed from recordings, so it measures my code, not the network. Cache hits skip NER and the DB entirely." |
| 62.5% and 93.3% hit rate | "A real browser session through the UI. One user changing sections forces a rebuild per section (3 of 8). Users who share a section share one build (1 of 15)." |
| 50 → 1 rebuild | "An asyncio lock per section with a double-checked cache read, so a thundering herd after expiry triggers one Guardian call instead of 50." |
| 4.56 ms NER per headline | "spaCy's small English model on CPU. The input is the app's own string (title + headline, 156 characters median); in production the standfirst makes it longer. The model loads once, in 290 ms." |
| 51 ms per refresh | "10 headlines through NER (49 ms) plus a geocode-cache read (1.4 ms), with geocodes already cached. Without the cache, Nominatim's 1 request per second dominates." |
| 94% placed correctly | "I checked every marker by hand on 30 live headlines. The one miss was Newcastle, Australia being placed in the UK, a classic name ambiguity." |
| 43% no marker | "Most headlines name no place ('Microsoft outage…'). Only 2 of the 13 really missed a place, so the filters favour precision over recall on purpose." |
| 89% geocode cache | "Over the 25 real rebuilds, only 14 of 129 lookups went to OpenStreetMap. It's a best case, because the feeds didn't change that afternoon. On Render's free tier, a restart wipes SQLite unless DATABASE_URL points at Postgres." |
| 179 KiB gzipped JS | "One chunk, and Three.js is most of it. Code-splitting the login page from the globe would shrink first load." |
| Lighthouse 84 | "Mobile preset with simulated throttling, median of 3. Total blocking time (540 ms) is what keeps it under 90, from parsing Three.js on the main thread." |
| 468 ms FCP | "Median of 4 page loads of the live Vercel site through a headless browser; the first, cold-cache load was 1.1 s." |
| bcrypt cost 12, 281 ms login | "Cost 12 means 2^12 rounds, about 270 ms per check on this 2.1 GHz Xeon. That's slow on purpose, so offline brute force is expensive." |
| 1.7 s login on Render | "Same cost factor on a shared free-tier CPU. In a paid deploy I'd tune the cost to the hardware, aiming for about 250 ms." |
| 111 tests, 92% coverage | "91 pytest plus 20 Vitest. 92% is backend line coverage with the test files excluded; the frontend is 25%, and that's my next gap to close." |
| 64 s CI | "Median wall time of 11 runs of the current workflow: backend on SQLite and on a Postgres 16 service, plus frontend lint, test and build, in parallel jobs." |

## Final resume bullets

Every keyword is kept and each bullet is about 30 words or fewer. Only numbers from the tables above are used.

- Built a **3D interactive news globe** in **React**, **Three.js** and **WebGL** showing live stories as clickable markers, with a 179 KiB gzipped bundle and a Lighthouse score of 84.
- Built a **Python** **FastAPI** **REST API** serving personalized news from **The Guardian API**; **caching** cut production p50 latency from 1.3 s to 58 ms and merged 50 concurrent requests into one.
- Used **NLP** (**spaCy NER**) and **geocoding** (**OpenStreetMap**) to pin each headline on the map; 94% of placed stories landed correctly and a geocode cache served 89% of lookups.
- Implemented secure login with **JWT authentication**, **bcrypt** password hashing (cost factor 12) and **SQLAlchemy** for user and preference data.
- Set up **CI/CD** with **GitHub Actions** running 111 **pytest** and **Vitest** tests (92% backend coverage) in about a minute; deployed on **Vercel** and **Render**.

Check the 94% first: it rests on my provisional verdicts until you check the accuracy table below.

## Accuracy review: 30 live headlines

These are the headlines and markers the **live site** served during the poll window, with the place each marker resolves to (recomputed from the recorded Nominatim answers; the coordinates matched production 23 / 23). The verdicts are **mine and provisional**, judged from the headline and URL. Put your own verdict in the `your_verdict` column of `bench/results/accuracy_review.csv` and run `python bench/accuracy.py`; your verdicts replace mine.

Verdicts:
- **correct**: every marker is at a place the story names or is about.
- **partial**: some markers right, some wrong.
- **wrong**: markers, but none right.
- **none-ok**: no marker, and no place is named.
- **none-missed**: no marker, but a place is named.

| # | Section | Headline | Marker(s) placed | Verdict (provisional) | Note |
|---|---|---|---|---|---|
| 1 | technology | [Microsoft says services fully restored after global outage hits governments](https://www.theguardian.com/technology/2026/nov/14/microsoft-says-services-fully-restored-after-global-outage) | - | **none-ok** | no place named |
| 2 | technology | [Microsoft outage shakes up companies, schools and local governments across US](https://www.theguardian.com/technology/2026/nov/13/microsoft-outage-shakes-up-companies-local-governments) | US → United States (39.78, -100.45) | **correct** |  |
| 3 | technology | [Microsoft ‘deeply sorry’ for disruption affecting millions and says it’s ‘not related to cyber or AI’ – as it happened](https://www.theguardian.com/technology/live/2026/nov/13/microsoft-outage-down-today-live-update-outlook-teams-365-when-fixed-latest-status-cause-news) | - | **none-ok** | no place named |
| 4 | technology | [Nvidia scandal: US treasury chief blames Lutnick’s commerce department over alleged lack of action](https://www.theguardian.com/technology/2026/nov/13/nvidia-scandal-sparks-us-national-security-concerns-china) | US → United States (39.78, -100.45) | **correct** | US treasury story |
| 5 | technology | [How Microsoft outage has affected key public services in the UK](https://www.theguardian.com/technology/2026/nov/13/how-microsoft-outage-has-affected-key-public-services-in-the-uk) | UK → United Kingdom (54.70, -3.28) | **correct** |  |
| 6 | technology | [Microsoft outage hits hospitals, GPs, schools and police across UK](https://www.theguardian.com/technology/2026/nov/13/microsoft-outage-hits-nhs-hospitals-gps-schools-and-police-across-uk) | UK → United Kingdom (54.70, -3.28) | **correct** |  |
| 7 | technology | [How it feels to battle with a flood of AI-generated complaints](https://www.theguardian.com/technology/2026/nov/13/how-it-feels-to-battle-with-a-flood-of-ai-generated-complaints) | - | **none-ok** | no place named |
| 8 | technology | [Microsoft scrambles to fix global outage affecting Teams and Outlook](https://www.theguardian.com/technology/2026/nov/13/microsoft-outage-outlook-teams-word-excel-reports) | - | **none-ok** | no place named |
| 9 | technology | [A global Microsoft 365 outage has hit millions – what happened and when will it be fixed?](https://www.theguardian.com/australia-news/2026/nov/13/global-microsoft-outage-what-happened-and-why) | - | **none-ok** | no place named |
| 10 | technology | [Marlon Brando cool to Jensen Huang joke: how the black leather jacket became a meme](https://www.theguardian.com/technology/2026/nov/13/marlon-brando-cool-jensen-huang-joke-black-leather-jacket-nvidia) | Hollywood → Hollywood, Los Angeles (34.10, -118.33) | **correct** | debatable: Hollywood comes from the standfirst (Brando reference), not where the story happens |
| 11 | sport | [Cheltenham November meeting horse racing – live](https://www.theguardian.com/sport/live/2026/nov/14/cheltenham-november-meeting-horse-racing-live) | - | **none-missed** | Cheltenham is named but spaCy did not tag it |
| 12 | sport | [England ready to play first Test in Zimbabwe since bad-tempered 1996 tour](https://www.theguardian.com/sport/2026/nov/14/england-first-test-zimbabwe-since-1996-cricket-exclusive) | England → England, United Kingdom (52.53, -1.26); Zimbabwe → Zimbabwe (-18.46, 29.75) | **correct** |  |
| 13 | sport | [‘Stinks of a cover-up’: David Warner fans flames with new sandpapergate claim](https://www.theguardian.com/sport/2026/nov/14/david-warner-statement-sandpapergate-ball-tampering-australia-cricket-ntwnfb) | - | **none-ok** | no place named (Australia implied only) |
| 14 | sport | [Scientists find blood biomarker that opens door to CTE diagnosis in living patients](https://www.theguardian.com/sport/2026/nov/14/scientists-find-blood-biomarker-cte-diagnosis-rugby-american-football) | - | **none-ok** | no place named |
| 15 | sport | [France cling on for furious victory against South Africa after Dupont sizzles](https://www.theguardian.com/sport/2026/nov/13/france-south-africa-nations-championship-match-report) | France → France (46.60, 1.89); South Africa → South Africa (-28.82, 24.99) | **correct** | the two teams' countries |
| 16 | sport | [A cricketing drama to divide a nation: why the sandpaper scandal is Australia’s Bazball](https://www.theguardian.com/sport/2026/nov/13/sandpaper-affair-australia-pat-cummins-cricket-england-scandal) | Australia → Australia (-24.78, 134.75) | **correct** |  |
| 17 | sport | [Jonbon shines on yet another trying day for troubled home of jumps racing](https://www.theguardian.com/sport/2026/nov/13/jonbon-shines-trying-day-troubled-home-of-jumps-racing-cheltenham-horse-racing-tips) | - | **none-ok** | Cheltenham implied, not named |
| 18 | sport | [Maro Itoje warns England not to sleepwalk into clash with Eddie Jones’s Japan](https://www.theguardian.com/sport/2026/nov/13/maro-itoje-england-sleepwalk-eddie-jones-japan-rugby-union) | England → England, United Kingdom (52.53, -1.26) | **correct** | Japan named too but missed (not wrong, incomplete) |
| 19 | sport | [Rugby League World Cup finals, ATP and WTA tennis, plus WSL – follow with us](https://www.theguardian.com/sport/2026/nov/13/rugby-league-world-cup-finals-atp-and-wta-tennis-plus-wsl-follow-with-us) | - | **none-ok** | no place named |
| 20 | sport | [England have licence to thrill against Japan after acing audition against Australia](https://www.theguardian.com/sport/2026/nov/13/england-have-licence-to-thrill-against-japan-after-acing-audition-against-australia) | England → England, United Kingdom (52.53, -1.26); Japan → 日本 (36.57, 139.24); Australia → Australia (-24.78, 134.75) | **correct** | Japan's label is in Japanese; coordinates right |
| 21 | environment | [Greenpeace boulders may delay building of £12bn windfarms in North Sea](https://www.theguardian.com/environment/2026/nov/14/greenpeace-boulders-norfolk-vanguard-windfarms) | North Sea → North Sea / Nordsee / Noordzee / Nordsøen / Nordsjøen / Mer du Nord (56.00, 2.81); Norfolk → Norfolk, England (52.67, 1.00) | **correct** | Norfolk from the standfirst (Norfolk Vanguard windfarm) |
| 22 | environment | [Bristol aims to become UK’s first ‘wetland city’ and reduce flood risk](https://www.theguardian.com/environment/2026/nov/14/bristol-first-uk-wetland-city-flood) | UK → United Kingdom (54.70, -3.28) | **correct** | Bristol (more specific) missed |
| 23 | environment | [‘An environmental and welfare disaster’: British salmon loses its organic status](https://www.theguardian.com/environment/2026/nov/14/salmon-organic-british-farmed-environmental-welfare) | - | **none-missed** | 'British' (adjective) not mapped; arguable |
| 24 | environment | [Country diary: One of Britain’s oldest surviving traditions – and it’s all over in four minutes](https://www.theguardian.com/environment/2026/nov/14/country-diary-one-of-britains-oldest-surviving-traditions-and-its-all-over-in-four-minutes) | Britain → United Kingdom (54.70, -3.28) | **correct** |  |
| 25 | environment | [Hundreds take to water for Newcastle coal port protest despite attempt by NSW police to stop them](https://www.theguardian.com/environment/2026/nov/14/rising-tide-protest-newcastle-coal-port-blockade-nsw-police-ntwnfb) | Newcastle → Newcastle upon Tyne, Tyne and Wear (54.97, -1.61) | **wrong** | Newcastle NSW, Australia placed at Newcastle upon Tyne, UK (name ambiguity) |
| 26 | environment | [Anthony Albanese’s coffee diplomacy can’t remove shadow of domestic politics at Cop31](https://www.theguardian.com/environment/2026/nov/13/anthony-albaneses-coffee-diplomacy-cant-remove-shadow-of-domestic-politics-at-cop31) | Turkey → Türkiye (39.29, 35.23) | **correct** | Cop31 venue, Turkey, from the standfirst |
| 27 | environment | [‘You cannot build peace on a burning planet,’ UN chief tells Cop31 in farewell speech](https://www.theguardian.com/environment/2026/nov/13/cop31-antonio-guterres-united-nations-climate-action) | - | **none-ok** | no place named |
| 28 | environment | [California governor Gavin Newsom endorses global fossil fuel phaseout](https://www.theguardian.com/environment/2026/nov/13/california-gavin-newsom-endorses-fossil-fuel-phaseout) | California → California, United States (36.70, -118.76); US → United States (39.78, -100.45) | **correct** |  |
| 29 | environment | [Right to make green challenges to planning decisions under threat, say UK lawyers](https://www.theguardian.com/environment/2026/nov/13/right-to-make-green-challenges-planning-decisions-under-threat-aarhus-convention) | UK → United Kingdom (54.70, -3.28) | **correct** |  |
| 30 | environment | [Cop31 as it happened: ‘You cannot build peace on a burning planet’, warns UN chief Guterres in final climate summit speech](https://www.theguardian.com/environment/live/2026/nov/13/cop31-climate-crisis-talks-turkey-latest-news-updates) | - | **none-ok** | no place named |

Some markers come from the Guardian standfirst (`trailText`), not the headline: #10 Hollywood, #21 Norfolk, #26 Turkey. The live app reads the headline and the standfirst; `/news` returns only the headline, so this table can show only the headline.

## Methodology

- **Percentiles**: linear interpolation between the nearest ranks (same as `numpy.percentile`'s default), in `bench/common.py:pct`.
- **Repeats**: every local benchmark runs 3 times and the table shows the median of the 3 runs' statistics. The production numbers come from one continuous 2 h 16 min poll, plus an earlier partial run with its technology samples excluded, because that run had a TLS-handshake artefact. Production samples are pooled, not "median of 3".
- **Production poll** (`bench/production/poll_live.py`): every 60 s:
  1. one warm-up `GET /openapi.json`, so connection setup isn't counted;
  2. `GET /news` for 3 throwaway accounts (one per section);
  3. a baseline `GET /openapi.json`;
  4. a `POST /login` every 5th loop.

  The accounts are created at the start and deleted at the end.
- **Telling hits from misses in production**: latency over 600 ms counts as a miss. The distribution has two clear clusters: 355 requests under 100 ms, 2 at 100–300 ms, 25 at 1 s or more, and none between 300 ms and 1 s. To check this, consecutive misses of a section must be one TTL apart; 20 of 20 gaps were 955–960 s.
- **Rate limits**: the Guardian API was never called from this machine (no key; see below). Nominatim was called **once per distinct place name** (17 names, ≥ 1.1 s apart) by `bench/record_nominatim.py`, and every later run replays `bench/fixtures/nominatim.json`.
- **Fixtures**: `bench/make_fixtures.py` turns the production `/news` responses into Guardian-shaped records (`webTitle` and `headline` = the headline, `trailText` empty). Local runs therefore feed spaCy only the headline. The live app also reads the standfirst.
- **Local server**: `bench/backend/harness.py` runs the real `server.app` on uvicorn with only `news.fetch_guardian_results` and `news.geocode` replaced. Two routes exist only in the benchmark (`/__bench/counters`, `/__bench/clear_cache`) and are added at runtime, never to the app.
- **Cache sessions** (`bench/frontend/session.cjs`): Playwright drives the real built frontend against the local server. The cache is cleared before each scenario, and the server's counters give the truth.
  - Scenario A: log in, reload twice, switch to sport, back to technology, then to environment, reload, log out, log in.
  - Scenario B: 5 users on technology, each logs in and reloads twice.
- **FPS** (`bench/frontend/fps.cjs`): a stub API serves N random markers, and I count distinct `requestAnimationFrame` timestamps during a 10 s drag. This container has **no GPU** (SwiftShader software WebGL), so the absolute FPS means nothing for real users. Only the trend is informative: every marker is its own mesh, one draw call each, so FPS falls with marker count. `InstancedMesh` would fix that.
- **Lighthouse** 13.5.0: default mobile preset with simulated throttling, Chrome for Testing 153, 3 runs; the median score is reported.
- **Coverage**: pytest-cov 6.0.0 with `bench/coveragerc` (test files excluded); `@vitest/coverage-v8` 2.1.9 was installed temporarily and `package.json` and the lockfile were restored afterwards.
- **CI**: GitHub Actions API, `tests.yml`, completed runs; duration = `updated_at − run_started_at`.

## Machine and software

| | |
|---|---|
| CPU | Intel Xeon @ 2.10 GHz, 4 vCPU (cloud container) |
| Memory | 15 GiB |
| OS | Ubuntu 24.04.5 LTS, kernel 6.18.44 |
| GPU | none (headless; WebGL through SwiftShader) |
| Python | 3.13.18, with FastAPI 0.162.2, SQLAlchemy 2.1.8, bcrypt 5.0.0, geopy 2.5.0, spaCy 3.8.18 + `en_core_web_sm` 3.8.0 |
| Node | 22.23.4, pnpm 10.28.0, Playwright 1.63.0, Lighthouse 13.5.0, Chrome for Testing 153.0.8010.12 |
| Production | Render free tier (backend, SQLite, no `DATABASE_URL`), Vercel (frontend) |

## Exact commands

Run `bench/run_all.sh` from the repo root; it runs every step in order and marks which ones use the network. In short:

```bash
pip install -r backend/requirements-dev.txt -r bench/requirements.txt
python bench/production/poll_live.py --minutes 110 --out bench/results/raw/production_poll.jsonl   # network, about 2 h
python bench/production/analyze_production.py
python bench/make_fixtures.py
python bench/record_nominatim.py            # network, only for names not yet recorded, 1 request/s or slower
python bench/backend/bench_news_latency.py
python bench/backend/bench_nlp.py
python bench/backend/bench_auth.py
python bench/backend/bench_burst.py
python bench/geocache.py
python bench/accuracy.py
bash bench/tests_coverage.sh
# frontend: build, then bundle_size.cjs, load_time.cjs, fps.cjs, lighthouse.sh, session.cjs (see run_all.sh)
```

## Raw outputs (`bench/results/raw/`)

| File | Contents |
|---|---|
| `production_poll.jsonl`, `production_poll_run1.jsonl` | every production request: time, kind, status, ms, and the `/news` body |
| `production_summary.json` | hit/miss/login/baseline statistics, histogram, TTL check, every miss |
| `news_latency_local.json` | the 3 runs, with every cold and warm sample in ms |
| `nlp_pipeline_local.json` | model load times, NER samples, and refresh breakdowns |
| `auth_local.json` | bcrypt cost, and verify/hash/login/signup samples |
| `cache_burst.json`, `cache_sessions.jsonl` | the concurrency burst and the UI session scenarios |
| `geocache.json` | lookups and Nominatim calls for each of the 25 rebuilds |
| `accuracy_summary.json` (and `../accuracy_review.csv`, `../accuracy_labels.json`) | the accuracy counts and the table above |
| `bundle_size.json`, `load_local.json`, `load_vercel.json` | file sizes and per-run load timings |
| `lighthouse_{local,vercel}_{1,2,3}.json` | the full Lighthouse reports |
| `fps_swiftshader.json`, `fps_swiftshader_baseline.json` | frames, seconds, fps, and frame-time p50/p95 for each run |
| `pytest_collect.txt`, `pytest_coverage.txt`, `coverage_backend.json`, `vitest_coverage.txt`, `coverage_frontend/` | test counts and coverage |
| `ci_runs.json` | duration and result of each GitHub Actions run |

## What could not be measured

| Item | Why | What's reported instead |
|---|---|---|
| Calling the Guardian API directly, and its latency | This session has no Guardian API key, and the secure form for adding one can't open in the app version in use. The Guardian's site is also blocked by this environment's network policy. | Production `/news` was timed end to end (it calls the real Guardian). Local runs replay those real headlines. |
| 50 headlines for accuracy | On this Saturday afternoon the three sections published nothing new for 2 h 16 min. The live site served the same 30 stories all along: it rebuilt every 15 min (each rebuild updated the cache, which a failing Guardian call wouldn't do), and the content didn't change. | All 30 unique headlines. Re-run the poller on a weekday to reach 50. |
| Real users' cache hit rate | There are no production request logs (Render's free tier keeps none that I can reach), and the only traffic was my poller. | Scripted sessions (62.5% / 93.3%) and the polling pattern (93.5%), each labelled as what it is. |
| FPS on real hardware | No GPU in the container. | Software-rendered numbers, marked as not for the resume. Run `node bench/frontend/fps.cjs <url> 3 100,500,1000` on your laptop to get real ones. |
| Long-run geocode hit rate across restarts | Render's disk is ephemeral, so SQLite (and the geocode cache) is wiped on every restart; one afternoon can't show how often that happens. | The hit rate between restarts (89.1%). |
| Accuracy with the standfirst | `/news` doesn't return `trailText`. | Production markers (which did use it) are shown as they were served. |
