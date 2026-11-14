#!/usr/bin/env bash
# Benchmark 5d: Lighthouse performance score (mobile preset, simulated throttling = Lighthouse defaults).
# Usage: bash lighthouse.sh <url> <label> [runs=3] [--proxy]
set -euo pipefail
URL=$1; LABEL=$2; RUNS=${3:-3}; OUT=$(cd "$(dirname "$0")/../results/raw" && pwd)
export CHROME_PATH=${CHROME_PATH:-$(ls /opt/pw-browsers/chromium-*/chrome-linux64/chrome 2>/dev/null | head -1)}
FLAGS="--headless=new --no-sandbox"
[[ "${4:-}" == "--proxy" ]] && FLAGS="$FLAGS --proxy-server=$HTTPS_PROXY --ignore-certificate-errors"
for i in $(seq 1 "$RUNS"); do
  npx -y lighthouse@13.5.0 "$URL" --only-categories=performance --output=json --quiet \
      --chrome-flags="$FLAGS" --output-path="$OUT/lighthouse_${LABEL}_$i.json"
done
