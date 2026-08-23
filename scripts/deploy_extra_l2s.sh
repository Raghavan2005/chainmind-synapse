#!/usr/bin/env bash
# Deploy ClaimSource on extra Superchain L2s (Base / OP / Ink / Mode / Soneium).
# Does not redeploy Sepolia or Unichain. Refuses mainnet. Writes addresses into .env only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "missing .env" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a
: "${DEPLOYER_PRIVATE_KEY:?}"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
else
  PYTHON="${PYTHON:-python3}"
fi

ADDR=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
echo "deployer=$ADDR"

_upsert() {
  local key="$1" value="$2"
  "$PYTHON" - "$ROOT/.env" "$key" "$value" <<'PY'
from pathlib import Path
import sys
path, key, value = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
lines = path.read_text(encoding="utf-8").splitlines()
found = False
out = []
for line in lines:
    if line.startswith(f"{key}="):
        out.append(f"{key}={value}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY
}

deploy_one() {
  local slug="$1" env_key="$2" rpc="$3" expect="$4" explorer="$5"
  local id wei out addr
  id=$(cast chain-id --rpc-url "$rpc")
  if [[ "$id" != "$expect" ]]; then
    echo "skip $slug: rpc chain $id expected $expect" >&2
    return 1
  fi
  if [[ "$id" == "1" || "$id" == "137" ]]; then
    echo "refusing mainnet/polygon $slug" >&2
    return 1
  fi
  wei=$(cast balance "$ADDR" --rpc-url "$rpc")
  echo "${slug}_wei=$wei"
  "$PYTHON" - "$wei" "$slug" <<'PY'
import sys
wei = int(sys.argv[1], 0)
if wei < 8_000_000_000_000_000:
    print(f"UNFUNDED {sys.argv[2]}: need >= 0.008 ETH. Run scripts/bridge_sepolia_to_l2.sh {sys.argv[2]} 0.03", file=sys.stderr)
    raise SystemExit(2)
PY
  out=$(cd "$ROOT/contracts" && forge script script/DeployClaimSource.s.sol:DeployClaimSource \
    --rpc-url "$rpc" --broadcast --private-key "$DEPLOYER_PRIVATE_KEY")
  addr=$(printf '%s\n' "$out" | awk '/ClaimSource /{print $2; exit}')
  if [[ -z "$addr" ]]; then
    echo "deploy parse failed for $slug" >&2
    printf '%s\n' "$out" >&2
    return 1
  fi
  echo "${env_key}=$addr"
  echo "${slug}_explorer=${explorer}/address/${addr}"
  _upsert "$env_key" "$addr"
}

deploy_one base CLAIM_SOURCE_BASE_SEPOLIA \
  "${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}" 84532 \
  "https://sepolia.basescan.org"
deploy_one op CLAIM_SOURCE_OP_SEPOLIA \
  "${OP_SEPOLIA_RPC_URL:-https://sepolia.optimism.io}" 11155420 \
  "https://sepolia-optimism.etherscan.io"
deploy_one ink CLAIM_SOURCE_INK_SEPOLIA \
  "${INK_SEPOLIA_RPC_URL:-https://rpc-gel-sepolia.inkonchain.com}" 763373 \
  "https://explorer-sepolia.inkonchain.com"
deploy_one mode CLAIM_SOURCE_MODE_SEPOLIA \
  "${MODE_SEPOLIA_RPC_URL:-https://sepolia.mode.network}" 919 \
  "https://sepolia.explorer.mode.network"
deploy_one soneium CLAIM_SOURCE_SONEIUM_MINATO \
  "${SONEIUM_MINATO_RPC_URL:-https://rpc.minato.soneium.org}" 1946 \
  "https://soneium-minato.blockscout.com"

echo "wrote extra L2 ClaimSource addresses into .env (not git)"
