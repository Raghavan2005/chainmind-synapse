#!/usr/bin/env bash
# Back-compat wrapper. Prefer scripts/bridge_sepolia_to_l2.sh unichain …
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/bridge_sepolia_to_l2.sh" unichain "${1:-0.06}" "${2:-}" --wait
