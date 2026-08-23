#!/usr/bin/env bash
# Deploy ClaimSource (Sepolia + Amoy) and IdentityState (Sepolia). Refuses if unfunded.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "missing .env — copy .env.example and fill DEPLOYER_PRIVATE_KEY" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a
: "${DEPLOYER_PRIVATE_KEY:?}"
: "${SEPOLIA_RPC_URL:?}"
: "${AMOY_RPC_URL:?}"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
else
  PYTHON="${PYTHON:-python3}"
fi

ADDR=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
echo "deployer=$ADDR"

SEP_WEI=$(cast balance "$ADDR" --rpc-url "$SEPOLIA_RPC_URL")
AMOY_WEI=$(cast balance "$ADDR" --rpc-url "$AMOY_RPC_URL")
echo "sepolia_wei=$SEP_WEI"
echo "amoy_wei=$AMOY_WEI"

"$PYTHON" - "$SEP_WEI" "$AMOY_WEI" <<'PY'
import sys
sep, amoy = int(sys.argv[1], 0), int(sys.argv[2], 0)
# ~0.02 ETH / 0.05 POL covers two Sepolia deploys + one Amoy deploy with headroom.
if sep < 20_000_000_000_000_000 or amoy < 50_000_000_000_000_000:
    print("UNFUNDED: need >= 0.02 Sepolia ETH and >= 0.05 Amoy POL on the deployer.", file=sys.stderr)
    print("Sepolia: https://cloud.google.com/application/web3/faucet/ethereum/sepolia", file=sys.stderr)
    print("Amoy:    https://www.alchemy.com/faucets/polygon-amoy", file=sys.stderr)
    raise SystemExit(2)
print("funded=yes")
PY

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

cd "$ROOT/contracts"
export DEPLOYER_PRIVATE_KEY OPERATOR_ADDRESS

SEP_OUT=$(forge script script/DeployClaimSource.s.sol:DeployClaimSource \
  --rpc-url "$SEPOLIA_RPC_URL" --broadcast --private-key "$DEPLOYER_PRIVATE_KEY")
SEP_CLAIM=$(printf '%s\n' "$SEP_OUT" | awk '/ClaimSource /{print $2; exit}')
echo "CLAIM_SOURCE_SEPOLIA=$SEP_CLAIM"

AMOY_OUT=$(forge script script/DeployClaimSource.s.sol:DeployClaimSource \
  --rpc-url "$AMOY_RPC_URL" --broadcast --private-key "$DEPLOYER_PRIVATE_KEY")
AMOY_CLAIM=$(printf '%s\n' "$AMOY_OUT" | awk '/ClaimSource /{print $2; exit}')
echo "CLAIM_SOURCE_AMOY=$AMOY_CLAIM"

ID_OUT=$(forge script script/DeployIdentityState.s.sol:DeployIdentityState \
  --rpc-url "$SEPOLIA_RPC_URL" --broadcast --private-key "$DEPLOYER_PRIVATE_KEY")
IDENTITY=$(printf '%s\n' "$ID_OUT" | awk '/IdentityState /{print $2; exit}')
echo "IDENTITY_STATE_SEPOLIA=$IDENTITY"

if [[ -z "$SEP_CLAIM" || -z "$AMOY_CLAIM" || -z "$IDENTITY" ]]; then
  echo "deploy parse failed — check forge output above" >&2
  exit 1
fi

_upsert CLAIM_SOURCE_SEPOLIA "$SEP_CLAIM"
_upsert CLAIM_SOURCE_AMOY "$AMOY_CLAIM"
_upsert IDENTITY_STATE_SEPOLIA "$IDENTITY"
_upsert OPERATOR_ADDRESS "$ADDR"
echo "wrote addresses into .env (not git)"
echo "sepolia_claim https://sepolia.etherscan.io/address/${SEP_CLAIM}"
echo "amoy_claim https://amoy.polygonscan.com/address/${AMOY_CLAIM}"
echo "identity https://sepolia.etherscan.io/address/${IDENTITY}"
