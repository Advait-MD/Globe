#!/usr/bin/env bash
# Reproduce every number in bench/RESULTS.md. Run from the repo root with the backend's Python
# environment active (pip install -r backend/requirements-dev.txt -r bench/requirements.txt)
# and Node 22 + pnpm. Steps marked [network] touch live services; everything else replays fixtures.
set -euo pipefail
cd "$(dirname "$0")/.."

# 0. [network] production polling (2 h). Collects real latency samples + real headlines/markers.
#    python bench/production/poll_live.py --minutes 110 --out bench/results/raw/production_poll.jsonl
python bench/production/analyze_production.py

# 1. fixtures from production snapshots; [network, only for names never seen] Nominatim at <= 1 req/s
python bench/make_fixtures.py
python bench/record_nominatim.py

# 2. backend benchmarks (replayed Guardian + Nominatim, local server)
python bench/backend/bench_news_latency.py
python bench/backend/bench_nlp.py
python bench/backend/bench_auth.py
python bench/backend/bench_burst.py
python bench/geocache.py
python bench/accuracy.py

# 3. tests + coverage
bash bench/tests_coverage.sh

# 4. frontend: builds, stub API, previews
OUT=$(mktemp -d)
(cd frontend/Civ && pnpm build --outDir "$OUT/prod" && VITE_API_URL=http://127.0.0.1:8765 pnpm build --outDir "$OUT/bench" \
   && VITE_API_URL=http://127.0.0.1:8766 pnpm build --outDir "$OUT/session")
node bench/frontend/bundle_size.cjs "$OUT/prod" > bench/results/raw/bundle_size.json
python bench/frontend/stub_backend.py --port 8765 & STUB=$!
python bench/backend/serve_replay.py --port 8766 --cors http://localhost:4182 & REPLAY=$!
(cd frontend/Civ && pnpm exec vite preview --outDir "$OUT/bench" --port 4180 --strictPort) & P1=$!
(cd frontend/Civ && pnpm exec vite preview --outDir "$OUT/prod" --port 4181 --strictPort) & P2=$!
(cd frontend/Civ && pnpm exec vite preview --outDir "$OUT/session" --port 4182 --strictPort) & P3=$!
trap 'kill $STUB $REPLAY $P1 $P2 $P3 2>/dev/null' EXIT
sleep 6
node bench/frontend/load_time.cjs http://localhost:4181/ local-preview 5 > bench/results/raw/load_local.json
node bench/frontend/load_time.cjs https://globe-mocha-eta.vercel.app/ vercel-live 5 --proxy > bench/results/raw/load_vercel.json  # [network]
node bench/frontend/fps.cjs http://localhost:4180/ 3 100,500,1000 > bench/results/raw/fps_swiftshader.json
node bench/frontend/fps.cjs http://localhost:4180/ 3 0,20 > bench/results/raw/fps_swiftshader_baseline.json
bash bench/frontend/lighthouse.sh http://localhost:4181/ local 3
bash bench/frontend/lighthouse.sh https://globe-mocha-eta.vercel.app/ vercel 3 --proxy                                   # [network]
for i in 1 2 3; do node bench/frontend/session.cjs http://localhost:4182; done > bench/results/raw/cache_sessions.jsonl
