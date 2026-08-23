# ChainMind Synapse

Two-chain identity-claim reconciler. Ingests `ClaimPosted` / `ClaimRevoked` from **Sepolia** and **Polygon Amoy**, scores each claim with a frozen sklearn model, fuses conflicts with subjective logic, commits a hash-only identity state on Sepolia, and serves it over REST.

The living spec is HTML: [`instructions/INDEX.html`](instructions/INDEX.html). `AGENTS.md` / `CLAUDE.md` only point there.

PRD named Goerli and Mumbai. Both were sunset in April 2024. This repo uses Sepolia `11155111` and Amoy `80002`.

## What is live (no stubbed scores)

- Solidity bulletin boards + append-only `IdentityState` (Foundry tests in CI).
- Real RPC ingest via web3.py against the two public testnets.
- HistGradientBoosting credibility model; held-out accuracy printed in `/v1/health`.
- Jøsang cumulative / averaging fusion with the MATH.html worked example locked in pytest.
- GET never calls an LLM. Explanation is async (Instructor if `LLM_API_KEY` is set, otherwise SHAP + template numbers).
- Overlay JSON is a cache. Replay rebuilds from logs.

Operator key can commit. That is a documented liveness concession, not a hidden IdP. Anyone can re-run the pipeline and check `stateHash`.

Public RPCs used here: `ethereum-sepolia-rpc.publicnode.com` and `polygon-amoy-bor-rpc.publicnode.com`. The INTEGRATION.html hosts (`rpc.sepolia.org`, `rpc-amoy.polygon.technology`) currently 404 / NXDOMAIN.

## Quick start

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git --shallow && forge test -vv && cd ..
python -m services.score.train
cp .env.example .env   # throwaway keys + faucet ETH/POL + deployed addresses
uvicorn services.api.main:app --host 0.0.0.0 --port 8000
# other terminal
python -m services.ingest.watch
bash scripts/demo_flow.sh
```

Dashboard (bonus): `cd dashboard && npm install && npm run dev`.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/v1/health` | heads, accuracy, contracts, RPC errors |
| GET | `/v1/identity/{subject}` | fused state + sources |
| GET | `/v1/identity/{subject}/history` | on-chain commit ids |
| GET | `/v1/identity/{subject}/explanation` | 404 until cached |
| POST | `/v1/replay/{subject}` | bearer `REPLAY_BEARER` |

## Deploy

Deploy scripts revert on chain id `1` and `137`.

```bash
cd contracts
forge script script/DeployClaimSource.s.sol:DeployClaimSource --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
forge script script/DeployClaimSource.s.sol:DeployClaimSource --rpc-url $AMOY_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
forge script script/DeployIdentityState.s.sol:DeployIdentityState --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
```

Paste addresses into `.env`.

## GitHub

- `.github/workflows/ci.yml` — Foundry, pytest + train, dashboard build, Docker image.
- `.github/workflows/aws-deploy.yml` — manual `workflow_dispatch` only; OIDC → ECR → App Runner (`AWS_ROLE_ARN`, `ECR_REPOSITORY`).
- Dependabot for pip, npm, Actions, Docker.

## AWS

`infra/aws` is Terraform for ECR, Secrets Manager, App Runner, and optional GitHub OIDC.

```bash
cd infra/aws
terraform init
terraform apply -var="region=eu-west-1"
```

Same image runs locally via `docker compose up --build`. Ingest and API share `data/overlay.json`. No hosted database is the source of truth.

## Compozy roster

Workspace agents (Cursor provider): `chainwright`, `brainwright`, `apowright`, `facewright` under `.compozy/agents/`. Spec stays in `instructions/*.html`.

## Known gaps (said out loud)

Operator key; optional LLM; synthetic labels; two EVM testnets ≠ every chain; `stateHash` is a commitment, not a zk proof of honest scoring. See `instructions/ARCHITECTURE.html`.
