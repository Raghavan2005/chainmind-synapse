#!/usr/bin/env bash
# Stand up a local Anvil devnet as the emergency second-claim-source when
# Unichain Sepolia itself (not just one RPC endpoint) is unreachable.
# instructions/CLAUDE.html: "PRD wants two blockchains, not two happy RPCs."
# This is a manual operator action — nothing in the app auto-starts Anvil.
# Say out loud in a demo if this is active; it is a local devnet, not a public testnet.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "missing .env — copy .env.example first" >&2
  exit 1
fi

ANVIL_RPC="${ANVIL_EMERGENCY_RPC_URL:-http://127.0.0.1:8545}"
# Anvil's well-known default account #0. Only ever holds local, ephemeral chain state.
ANVIL_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

if ! cast chain-id --rpc-url "$ANVIL_RPC" >/dev/null 2>&1; then
  echo "starting anvil on $ANVIL_RPC ..."
  mkdir -p data
  nohup anvil --host 127.0.0.1 --port 8545 > data/anvil_emergency.log 2>&1 &
  echo $! > data/anvil_emergency.pid
  for _ in $(seq 1 20); do
    cast chain-id --rpc-url "$ANVIL_RPC" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

cd "$ROOT/contracts"
OUT=$(DEPLOYER_PRIVATE_KEY="$ANVIL_KEY" forge script script/DeployClaimSource.s.sol:DeployClaimSource \
  --rpc-url "$ANVIL_RPC" --broadcast --private-key "$ANVIL_KEY")
ADDR=$(printf '%s\n' "$OUT" | awk '/ClaimSource /{print $2; exit}')
if [[ -z "$ADDR" ]]; then
  echo "deploy parse failed — check forge output above" >&2
  exit 1
fi
cd "$ROOT"

_upsert() {
  local key="$1" value="$2"
  python3 - "$ROOT/.env" "$key" "$value" <<'PY'
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
_upsert ANVIL_EMERGENCY_RPC_URL "$ANVIL_RPC"
_upsert CLAIM_SOURCE_ANVIL_EMERGENCY "$ADDR"
echo "wrote ANVIL_EMERGENCY_RPC_URL and CLAIM_SOURCE_ANVIL_EMERGENCY into .env"
echo "claim_source_anvil_emergency $ADDR"
echo "EMERGENCY MODE: ingest/API will use Anvil as the second source until Unichain Sepolia RPC answers again (checked every run, not sticky)."
echo "To post an emergency-source claim: cast send $ADDR \"postClaim(address,bytes32,int8,uint64,string)\" ... --rpc-url $ANVIL_RPC --private-key $ANVIL_KEY"
