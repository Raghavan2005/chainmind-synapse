#!/usr/bin/env bash
# Deposit Sepolia ETH into one Superchain L2 via that L2's own L1StandardBridge.
# Usage: bash scripts/bridge_sepolia_to_l2.sh <slug> [amount_eth] [to] [--wait|--no-wait]
# Slugs: unichain | base | op | ink | mode | soneium
# NEVER a mainnet L1StandardBridge (Unichain 0x81014F44… / Base 0x3154Cf16… / OP 0x99C9fc46…).
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

SLUG="${1:-}"
AMOUNT_ETH="${2:-0.03}"
TO_ARG="${3:-}"
WAIT_MODE="${4:---wait}"
if [[ -z "$SLUG" ]]; then
  echo "usage: $0 <unichain|base|op|ink|mode|soneium> [amount_eth] [to] [--wait|--no-wait]" >&2
  exit 2
fi
if [[ "${TO_ARG}" == --* ]]; then
  WAIT_MODE="$TO_ARG"
  TO_ARG=""
fi

case "$SLUG" in
  unichain|unichain_sepolia)
    BRIDGE="${UNICHAIN_L1_BRIDGE_SEPOLIA:-0xea58fcA6849d79EAd1f26608855c2D6407d54Ce2}"
    L2_RPC="${UNICHAIN_SEPOLIA_RPC_URL:?}"
    EXPECT_L2=1301
    LABEL="Unichain Sepolia"
    ;;
  base|base_sepolia)
    BRIDGE="${BASE_L1_BRIDGE_SEPOLIA:-0xfd0Bf71F60660E2f608ed56e1659C450eB113120}"
    L2_RPC="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"
    EXPECT_L2=84532
    LABEL="Base Sepolia"
    ;;
  op|op_sepolia|optimism)
    BRIDGE="${OP_L1_BRIDGE_SEPOLIA:-0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1}"
    L2_RPC="${OP_SEPOLIA_RPC_URL:-https://sepolia.optimism.io}"
    EXPECT_L2=11155420
    LABEL="OP Sepolia"
    ;;
  ink|ink_sepolia)
    BRIDGE="${INK_L1_BRIDGE_SEPOLIA:-0x33f60714BbD74d62b66D79213C348614DE51901C}"
    L2_RPC="${INK_SEPOLIA_RPC_URL:-https://rpc-gel-sepolia.inkonchain.com}"
    EXPECT_L2=763373
    LABEL="Ink Sepolia"
    ;;
  mode|mode_sepolia)
    BRIDGE="${MODE_L1_BRIDGE_SEPOLIA:-0xbC5C679879B2965296756CD959C3C739769995E2}"
    L2_RPC="${MODE_SEPOLIA_RPC_URL:-https://sepolia.mode.network}"
    EXPECT_L2=919
    LABEL="Mode Sepolia"
    ;;
  soneium|soneium_minato|minato)
    BRIDGE="${SONEIUM_L1_BRIDGE_SEPOLIA:-0x5f5a404A5edabcDD80DB05E8e54A78c9EBF000C2}"
    L2_RPC="${SONEIUM_MINATO_RPC_URL:-https://rpc.minato.soneium.org}"
    EXPECT_L2=1946
    LABEL="Soneium Minato"
    ;;
  *)
    echo "unknown slug $SLUG" >&2
    exit 2
    ;;
esac

BRIDGE_LC=$(printf '%s' "$BRIDGE" | tr '[:upper:]' '[:lower:]')
for FORBIDDEN in \
  0x81014f44b0a345033bb2b3b21c7a1a308b35feea \
  0x3154cf16ccdb4c6d922629664174b904d80f2c35 \
  0x99c9fc46f92e8a1c0dec1b1747d010903e884be1
do
  if [[ "$BRIDGE_LC" == "$FORBIDDEN" ]]; then
    echo "refusing mainnet L1StandardBridge $BRIDGE" >&2
    exit 1
  fi
done

CHAIN=$(cast chain-id --rpc-url "$SEPOLIA_RPC_URL")
if [[ "$CHAIN" != "11155111" ]]; then
  echo "SEPOLIA_RPC_URL is chain $CHAIN, expected 11155111" >&2
  exit 1
fi
L2_ID=$(cast chain-id --rpc-url "$L2_RPC")
if [[ "$L2_ID" != "$EXPECT_L2" ]]; then
  echo "$LABEL RPC is chain $L2_ID, expected $EXPECT_L2" >&2
  exit 1
fi

ADDR=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
TO="${TO_ARG:-$ADDR}"
WEI=$(cast to-wei "$AMOUNT_ETH" ether)

echo "from=$ADDR"
echo "to=$TO"
echo "amount_eth=$AMOUNT_ETH"
echo "l2=$LABEL ($EXPECT_L2)"
echo "bridge=$BRIDGE (Sepolia L1StandardBridge)"

if ! TX=$(cast send "$BRIDGE" "bridgeETHTo(address,uint32,bytes)" "$TO" 200000 0x \
  --value "$WEI" --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --json); then
  echo "bridgeETHTo failed — trying depositETHTo" >&2
  TX=$(cast send "$BRIDGE" "depositETHTo(address,uint32,bytes)" "$TO" 200000 0x \
    --value "$WEI" --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --json)
fi
HASH=$(printf '%s\n' "$TX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('transactionHash',''))")
echo "sepolia_tx=$HASH"
echo "sepolia_explorer=https://sepolia.etherscan.io/tx/${HASH}"

if [[ "$WAIT_MODE" == "--no-wait" ]]; then
  exit 0
fi

echo "waiting for $LABEL credit (usually 1–3 min)…"
for _ in $(seq 1 48); do
  BAL=$(cast balance "$TO" --rpc-url "$L2_RPC" --ether)
  echo "${SLUG}_eth=$BAL"
  python3 - "$BAL" <<'PY' && exit 0
import sys
if float(sys.argv[1]) > 0:
    raise SystemExit(0)
raise SystemExit(1)
PY
  sleep 5
done
echo "bridge submitted but $LABEL balance still 0 — check $HASH and retry later" >&2
exit 3
