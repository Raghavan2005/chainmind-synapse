#!/usr/bin/env bash
# Confirm the logged-in Vercel CLI and the dashboard project link.
# Does not deploy. Spec: instructions/DEVOPS.html
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASH="${ROOT}/dashboard"
CI_MODE=0

usage() {
  cat <<'EOF'
Usage: scripts/vercel_preflight.sh [--ci]

  (default)  Require vercel CLI, whoami, and dashboard/.vercel/project.json.
  --ci       Same checks; skip interactive whoami if VERCEL_TOKEN is set.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ci) CI_MODE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing dependency: $1" >&2; exit 1; }
}

need node
if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI missing — npm i -g vercel" >&2
  exit 1
fi

if [[ ! -f "${DASH}/vercel.json" ]]; then
  echo "missing ${DASH}/vercel.json" >&2
  exit 1
fi

if [[ "$CI_MODE" -eq 1 && -n "${VERCEL_TOKEN:-}" ]]; then
  vercel whoami --token "$VERCEL_TOKEN"
else
  vercel whoami
fi

PROJECT_JSON="${DASH}/.vercel/project.json"
if [[ ! -f "$PROJECT_JSON" ]]; then
  echo "dashboard/.vercel/project.json missing — run: cd dashboard && vercel link --yes --project chainmind-synapse" >&2
  exit 1
fi

python3 - <<PY
import json
from pathlib import Path
p = Path("${PROJECT_JSON}")
data = json.loads(p.read_text())
org = data.get("orgId") or data.get("org_id")
proj = data.get("projectId") or data.get("project_id")
if not org or not proj:
    raise SystemExit("project.json missing orgId/projectId")
print(f"orgId={org}")
print(f"projectId={proj}")
PY

echo "preflight ok"
