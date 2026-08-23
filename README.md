# ChainMind Synapse

Two-chain identity-claim reconciler. Ingests `ClaimPosted` / `ClaimRevoked` from **Sepolia** and **Unichain Sepolia**, scores each claim with a frozen sklearn model, fuses conflicts with subjective logic, commits a hash-only identity state on Sepolia, and serves it over REST.

The living spec is HTML: [`instructions/INDEX.html`](instructions/INDEX.html). `AGENTS.md` / `CLAUDE.md` only point there.

PRD named Goerli and Mumbai. Both were sunset in April 2024. Amoy was the first substitute; POL faucets dried. Human override: Sepolia `11155111` + Unichain Sepolia `1301` (ETH gas).

## What is live (no stubbed scores)

- Solidity bulletin boards + append-only `IdentityState` (Foundry tests in CI).
- Real RPC ingest via web3.py against the two public testnets.
- HistGradientBoosting credibility model; held-out accuracy printed in `/v1/health`.
- Jøsang cumulative / averaging fusion with the MATH.html worked example locked in pytest.
- GET never calls an LLM. Explanation is async (Instructor if `LLM_API_KEY` is set, otherwise SHAP + template numbers).
- Overlay JSON is a cache. Replay rebuilds from logs.

Operator key can commit. That is a documented liveness concession, not a hidden IdP. Anyone can re-run the pipeline and check `stateHash`.

Public RPCs used here: `ethereum-sepolia-rpc.publicnode.com` and `sepolia.unichain.org`. Bridge Sepolia ETH to Unichain with `bash scripts/bridge_sepolia_to_unichain.sh` (L1 proxy `0xea58fcA6…` on Sepolia — never mainnet `0x81014F44…`).

## Quick start

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git --shallow && forge test -vv && cd ..
python -m services.score.train
cp .env.example .env   # throwaway keys + Sepolia ETH + Unichain Sepolia ETH + deployed addresses
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
forge script script/DeployClaimSource.s.sol:DeployClaimSource --rpc-url $UNICHAIN_SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
forge script script/DeployIdentityState.s.sol:DeployIdentityState --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
```

Paste addresses into `.env`.

Live throwaway deploy (2026-08-23):

| Contract | Chain | Address |
| --- | --- | --- |
| ClaimSource | Sepolia | [`0x16366eaeEddB90C990704ee6d12C43B30D9CF614`](https://sepolia.etherscan.io/address/0x16366eaeEddB90C990704ee6d12C43B30D9CF614) |
| ClaimSource | Unichain Sepolia | [`0x5c2749F63fC6f50C600DA04f0Fd87bF8299c2c59`](https://sepolia.uniscan.xyz/address/0x5c2749F63fC6f50C600DA04f0Fd87bF8299c2c59) |
| IdentityState | Sepolia | [`0xE11CD3Bb815ED4CA95692907ABa6fB3180F84894`](https://sepolia.etherscan.io/address/0xE11CD3Bb815ED4CA95692907ABa6fB3180F84894) |

Gas path: Sepolia → Unichain via L1StandardBridge [`0xea58fcA6…`](https://sepolia.etherscan.io/address/0xea58fcA6849d79EAd1f26608855c2D6407d54Ce2) (`scripts/bridge_sepolia_to_unichain.sh`). Never the mainnet Unichain bridge.

Demo fixture (same subject `0x5cCBd2Ef7DBC744AbFF179F5C5B8180B182B1221`):

- Claim A Sepolia +1: [`0x258a839c…`](https://sepolia.etherscan.io/tx/0x258a839cc148b352ce1bc581dea792ae58c34b46748f95cda2d37371347a8d94)
- Claim B Unichain Sepolia −1: [`0x55e1f73e…`](https://sepolia.uniscan.xyz/tx/0x55e1f73e55556412280bf7844a4ec0a0cdf0d23776b8e7e5b05529b24106a197)
- Conflict `StateCommitted`: [`0x654ddce8…`](https://sepolia.etherscan.io/tx/0x654ddce8b47cba6b06fe9508ece0ffaf7b9aeb67d59f046bf2fcedad7bee4135)

## GitHub

- `.github/workflows/ci.yml` — Foundry, pytest + train, dashboard build, Docker image.
- `.github/workflows/aws-deploy.yml` — after CI succeeds on `master`/`main`, or `workflow_dispatch`. Deploy is skipped (neutral) unless repository variables `AWS_DEPLOY_ENABLED=true`, `AWS_ROLE_ARN`, and `ECR_REPOSITORY` are set. App Runner rolls only when `APPRUNNER_SERVICE_ARN` is set. Local check: `bash scripts/aws_preflight.sh`.
- Dependabot for pip, npm, Actions, Docker.

## AWS

`infra/aws` is Terraform for ECR, Secrets Manager, App Runner, and GitHub OIDC. Do not `terraform apply` the App Runner service until contracts are funded and you want a live URL.

Cheap GitHub Actions pieces (OIDC + `chainmind-synapse-gha` role + ECR) can be created without Terraform:

```bash
bash scripts/aws_preflight.sh --create   # us-east-1 unless AWS_REGION is set
# later: bash scripts/aws_preflight.sh --teardown
```

```bash
cd infra/aws
terraform init
terraform plan -var="region=us-east-1"   # plan only until App Runner is intentional
```

Same image runs locally via `docker compose up --build`. Ingest and API share `data/overlay.json`. No hosted database is the source of truth.

## Compozy roster

Workspace agents (Cursor provider): `chainwright`, `brainwright`, `apowright`, `facewright` under `.compozy/agents/`. Spec stays in `instructions/*.html`.

## Known gaps (said out loud)

Operator key; optional LLM; synthetic labels; two EVM testnets ≠ every chain; `stateHash` is a commitment, not a zk proof of honest scoring. See `instructions/ARCHITECTURE.html`.
