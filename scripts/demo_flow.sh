#!/usr/bin/env bash
# Posts conflicting claims A (Sepolia) and B (Amoy), waits for ingest+commit, curls GET.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "missing .env — copy .env.example and fill keys/addresses" >&2
  exit 1
fi
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
else
  PYTHON="${PYTHON:-python3}"
fi
set -a
# shellcheck disable=SC1091
source .env
set +a
: "${DEMO_SUBJECT:?}"
: "${CLAIM_SOURCE_SEPOLIA:?}"
: "${CLAIM_SOURCE_AMOY:?}"
: "${IDENTITY_STATE_SEPOLIA:?}"

"$PYTHON" -m services.score.train >/tmp/synapse-train.json
"$PYTHON" scripts/post_claims.py | tee /tmp/synapse-posts.json
START=$(date +%s)
"$PYTHON" -m services.ingest.watch --once
# API must already be up, or start one for the script
if ! curl -sf "http://127.0.0.1:${API_PORT:-8000}/v1/health" >/dev/null; then
  "$PYTHON" -m uvicorn services.api.main:app --host 127.0.0.1 --port "${API_PORT:-8000}" &
  API_PID=$!
  trap 'kill $API_PID 2>/dev/null || true' EXIT
  sleep 2
fi
BODY=$(curl -sf "http://127.0.0.1:${API_PORT:-8000}/v1/identity/${DEMO_SUBJECT}")
echo "$BODY" | "$PYTHON" -m json.tool
END=$(date +%s)
LATENCY=$((END - START))
echo "commit_latency_seconds=${LATENCY}"
if (( LATENCY > 120 )); then
  echo "NFR-02 failed: commit latency ${LATENCY}s > 120s" >&2
  exit 1
fi
"$PYTHON" scripts/verify_hash.py --subject "$DEMO_SUBJECT"
BODY="$BODY" "$PYTHON" - <<'PY'
import json, os
body = json.loads(os.environ["BODY"])
chains = {c["chainId"] for c in body.get("claims", [])}
if 11155111 not in chains or 80002 not in chains:
    raise SystemExit(f"FR-01 failed: sources={chains}")
if body.get("verdict") != "conflict" and not body.get("conflicts"):
    raise SystemExit(f"conflict fixture missing: verdict={body.get('verdict')}")
print("demo_flow ok", body["verdict"], body["scoreBps"])
PY
