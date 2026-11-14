#!/usr/bin/env bash
# Benchmark 7: test counts and line coverage. Run from the repo root.
#   backend : pytest + pytest-cov (bench/requirements.txt); app modules only, tests excluded
#   frontend: vitest + @vitest/coverage-v8 2.1.9, installed temporarily into node_modules
#             (package.json / pnpm-lock.yaml are restored afterwards, nothing is committed)
set -euo pipefail
ROOT=$(pwd); RAW=$ROOT/bench/results/raw; mkdir -p "$RAW"

echo "== backend"
cd "$ROOT/backend"
python -m pytest -q --co 2>/dev/null | tail -1 | tee "$RAW/pytest_collect.txt"
python -m pytest -q -p no:warnings --cov=. --cov-report=term --cov-report=json:"$RAW/coverage_backend.json" \
  --cov-config="$ROOT/bench/coveragerc" 2>&1 | grep -vE "^$" | tee "$RAW/pytest_coverage.txt" | tail -14

echo "== frontend"
cd "$ROOT/frontend/Civ"
cp package.json /tmp/pkg.bak && cp pnpm-lock.yaml /tmp/lock.bak
pnpm add -D @vitest/coverage-v8@2.1.9 >/dev/null 2>&1
pnpm exec vitest run --coverage.enabled --coverage.provider=v8 --coverage.reporter=text --coverage.reporter=json-summary \
  --coverage.reportsDirectory="$RAW/coverage_frontend" --coverage.include='src/**' --coverage.exclude='src/__tests__/**' \
  2>&1 | tee "$RAW/vitest_coverage.txt" | grep -E "Test Files|Tests |All files|\.jsx?|\.js " | head -20
cp /tmp/pkg.bak package.json && cp /tmp/lock.bak pnpm-lock.yaml
