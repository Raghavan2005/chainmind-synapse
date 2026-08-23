#!/usr/bin/env bash
# Lock Sepolia ETH in Unichain's L1StandardBridge and mint ETH on Unichain Sepolia.
# Sepolia proxy only: 0xea58fcA6849d79EAd1f26608855c2D6407d54Ce2
# NEVER the mainnet Unichain bridge 0x81014F44b0a345033bB2b3B21C7a1A308B35fEeA (chain id 1).
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
: "${SEPOLIA_RPC_URL:?}"
: "${UNICHAIN_SEPOLIA_RPC_URL:?}"

# Official Unichain Sepolia L1 Standard Bridge on Ethereum Sepolia (Uniswap docs).
BRIDGE="${UNICHAIN_L1_BRIDGE_SEPOLIA:-0xea58fcA6849d79EAd1f26608855c2D6407d54Ce2}"
MAINNET_BRIDGE="0x81014F44b0a345033bB2b3B21C7a1A308B35fEeA"
AMOUNT_ETH="${1:-0.06}"

BRIDGE_LC=$(printf '%s' "$BRIDGE" | tr '[:upper:]' '[:lower:]')
MAINNET_LC=$(printf '%s' "$MAINNET_BRIDGE" | tr '[:upper:]' '[:lower:]')
if [[ "$BRIDGE_LC" == "$MAINNET_LC" ]]; then
  echo "refusing mainnet Unichain bridge $MAINNET_BRIDGE" >&2
  exit 1
fi

CHAIN=$(cast chain-id --rpc-url "$SEPOLIA_RPC_URL")
if [[ "$CHAIN" != "11155111" ]]; then
  echo "SEPOLIA_RPC_URL is chain $CHAIN, expected 11155111" >&2
  exit 1
fi

ADDR=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
TO="${2:-$ADDR}"
WEI=$(cast to-wei "$AMOUNT_ETH" ether)

echo "from=$ADDR"
echo "to=$TO"
echo "amount_eth=$AMOUNT_ETH"
echo "bridge=$BRIDGE (Sepolia L1StandardBridge)"

# OP-stack aliases: prefer bridgeETHTo, fall back to depositETHTo.
if ! TX=$(cast send "$BRIDGE" "bridgeETHTo(address,uint32,bytes)" "$TO" 200000 0x \
  --value "$WEI" --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --json); then
  echo "bridgeETHTo failed — trying depositETHTo" >&2
  TX=$(cast send "$BRIDGE" "depositETHTo(address,uint32,bytes)" "$TO" 200000 0x \
    --value "$WEI" --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --json)
fi
HASH=$(printf '%s\n' "$TX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('transactionHash',''))")
echo "sepolia_tx=$HASH"
echo "sepolia_explorer=https://sepolia.etherscan.io/tx/${HASH}"
echo "waiting for Unichain Sepolia credit (usually 1–3 min)…"

for _ in $(seq 1 36); do
  BAL=$(cast balance "$TO" --rpc-url "$UNICHAIN_SEPOLIA_RPC_URL" --ether)
  echo "unichain_sepolia_eth=$BAL"
  python3 - "$BAL" <<'PY' && exit 0
import sys
if float(sys.argv[1]) > 0:
    raise SystemExit(0)
raise SystemExit(1)
PY
  sleep 5
done
echo "bridge submitted but Unichain balance still 0 — check $HASH and retry later" >&2
exit 3
