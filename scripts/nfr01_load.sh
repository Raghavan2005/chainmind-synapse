#!/usr/bin/env bash
# NFR-01 acceptance: warm local GET /v1/identity/{demo}, then hey -n 200 -c 20.
# Spec: instructions/REQUIREMENTS.html — this is localhost, not App Runner RTT.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${1:-http://127.0.0.1:8000}"
SUBJECT="${DEMO_SUBJECT:-0x5cCBd2Ef7DBC744AbFF179F5C5B8180B182B1221}"
URL="${BASE}/v1/identity/${SUBJECT}"

if ! curl -sf -o /dev/null "$URL"; then
  echo "warm GET failed: $URL"
  echo "start the API first: uvicorn services.api.main:app --host 127.0.0.1 --port 8000"
  exit 1
fi

if command -v hey >/dev/null 2>&1; then
  hey -n 200 -c 20 "$URL"
else
  echo "hey not installed; falling back to scripts/load_test.py (200 req / 20 concurrent)"
  python3 "${ROOT}/scripts/load_test.py" "$URL" --concurrency 20 --requests-per-worker 10
fi
