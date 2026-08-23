# ChainMind Synapse — Build Plan

## Context

This is the assigned PRD for a 6-hour hackathon round (myOnsite Ascend 2026, Round 2). The repo currently contains only `prd.md` and `research-existing-solutions.md` — no code yet. The team (2-4 people) needs a concrete, defensible architecture they can execute against the clock and defend live afterward (reviewers will probe design decisions, determinism, security, and what's a shortcut vs. a real solution).

**Problem being solved:** a credential issued on one blockchain can't be trusted/verified by a service on a different blockchain, and conflicting claims across chains go undetected. The system must ingest claims from 2+ chains, use AI to extract trust signals and score credibility, reconcile conflicts into one unified identity state, write that state immutably on-chain, and expose it via a REST API — without relying on centralized identity providers or pre-built identity/reconciliation SDKs.

**Locked tech decisions:**
- Backend: Python + FastAPI
- Smart contracts: Foundry (Solidity), not Hardhat
- Chain client: web3.py
- Gen-AI: Claude API (key available)
- ML: scikit-learn
- RPC: Alchemy (free tier)
- Chains: **Sepolia** (Ethereum) + **Polygon Amoy** (Polygon) — Goerli/Mumbai are deprecated, do not use them
- Local dev chain: Anvil (Foundry) for fast iteration before deploying to public testnets
- Storage: SQLite allowed only as a read-cache mirroring on-chain state (never the source of truth)
- Scope: MVP is required in full; the 3 PRD bonus items are attempted only after MVP works end-to-end, in PRD-listed priority order (revocation detection → Gen-AI explanation → dashboard). Note: the PRD's Deliverables section lists "a Gen-AI explanation of the trust decision" as required, so the explanation layer is built into the core pipeline, not deferred as bonus, despite also appearing in the bonus list.

**Intended outcome of this document:** a plan detailed enough to hand directly to 2-4 implementers working in parallel tracks, with concrete contract interfaces, JSON schemas, ML design, reconciliation logic, repo layout, and an hour-by-hour timeline — so the team can start building immediately without re-deriving these decisions mid-hackathon.

---

## 1. Smart Contracts (Foundry, Solidity)

Two contract types, three deployments:
- **`ClaimRegistry.sol`** deployed separately on **Sepolia** and **Polygon Amoy** (same source). Mock issuer wallets self-issue claims here — this is why it's not "a pre-built identity tool": it's ~50 lines of custom, generic attestation logic with no reconciliation logic on-chain.
- **`IdentityStateRegistry.sol`** deployed **once, on Sepolia only** — the designated ledger of record for the final reconciled state. (Single-chain designation is a deliberate, documented simplification: true cross-chain-consistent state needs a bridge/oracle, out of scope for 6 hours.)

### ClaimRegistry.sol

```solidity
enum ClaimStatus { Active, Revoked }

struct Claim {
    address subject;
    address issuer;
    string  claimType;   // e.g. "KYC_VERIFIED"
    string  metadata;    // small JSON, e.g. {"level":"gold","source":"mock-bank-A"}
    uint64  issuedAt;
    uint64  expiresAt;   // 0 = no expiry
    ClaimStatus status;
}

mapping(bytes32 => Claim) public claims;                // claimId => Claim
mapping(address => bytes32[]) public claimsBySubject;
mapping(address => bool) public isRegisteredIssuer;
mapping(bytes32 => uint256) public issuanceNonce;        // key = keccak256(subject,issuer,claimType)

event IssuerRegistered(address indexed issuer, string label);
event ClaimIssued(bytes32 indexed claimId, address indexed subject, address indexed issuer,
                   string claimType, string metadata, uint64 issuedAt, uint64 expiresAt);
event ClaimRevoked(bytes32 indexed claimId, address indexed subject, address indexed issuer, uint64 revokedAt);

function registerIssuer(address issuer, string calldata label) external onlyOwner;
function issueClaim(address subject, string calldata claimType, string calldata metadata, uint64 expiresAt)
    external onlyRegisteredIssuer returns (bytes32 claimId);
function revokeClaim(bytes32 claimId) external; // only original issuer
function getClaim(bytes32 claimId) external view returns (Claim memory);
function getClaimsBySubject(address subject) external view returns (bytes32[] memory);
```

**Determinism/idempotency:** `claimId = keccak256(abi.encode(subject, issuer, claimType, nonce, block.chainid))` where `nonce` comes from `issuanceNonce[keccak256(subject,issuer,claimType)]`, incremented on each issuance. Same inputs at the same nonce state → same id; re-issuing at a stale nonce collides with an existing `claimId` and reverts. Events carry the full payload so ingestion works from `eth_getLogs` alone; `getClaim`/`getClaimsBySubject` remain as an independent verification path.

### IdentityStateRegistry.sol (Sepolia only)

```solidity
struct IdentityState {
    address subject;
    bytes32 stateHash;       // keccak256 of canonical JSON of the unified state
    uint16  confidenceBps;   // confidence * 10000 (integer, no floats on-chain)
    uint8   status;          // 0=Verified,1=Conflicted,2=Insufficient,3=Revoked
    uint64  updatedAt;
    uint32  version;         // increments only on real change
    string  explanationURI;  // inline text or IPFS CID of the Gen-AI explanation
}

mapping(address => IdentityState) public latestState;
mapping(address => bool) public isReconciler;

event IdentityStateUpdated(address indexed subject, bytes32 indexed stateHash,
                            uint16 confidenceBps, uint8 status, uint32 version, uint64 updatedAt);

function registerReconciler(address r) external onlyOwner;
function updateIdentityState(address subject, bytes32 stateHash, uint16 confidenceBps,
                              uint8 status, string calldata explanationURI)
    external onlyReconciler returns (uint32 newVersion);
function getIdentityState(address subject) external view returns (IdentityState memory);
```

**Idempotency:** if `stateHash == latestState[subject].stateHash`, `updateIdentityState` returns the existing version as a no-op — no revert, no event, no version bump. Retried/duplicated pipeline runs with identical inputs are always safe. EVM account-nonce replay protection covers the transaction layer on top of this.

**Determinism of `stateHash`:** `keccak256(canonical_json({subject, considered_claim_ids, claim_source_chain_ids, algorithm_version: "v1", scores (integer bps), confidence_bps, status}))`. Canonical JSON = sorted keys, integers only (no floats), fixed field set, versioned algorithm tag — same claims + same algorithm version always hash identically, and any third party can recompute it (see §7).

---

## 2. Data Flow

```
Mock issuer wallets
  → issueClaim() on Sepolia ClaimRegistry AND Amoy ClaimRegistry (same subject, possibly conflicting)
  → [Ingestion] poll eth_getLogs on both chains, track per-chain last-block cursor, cache raw claims in SQLite
  → [Gen-AI Extraction — Claude, per claim] raw claim → structured trust-signal JSON
  → [ML Scoring — scikit-learn, per claim] structured features → credibility_score ∈ [0,1]
  → [Reconciliation — deterministic rules] combine same-subject/claimType claims across chains → unified value + status + confidence
  → [Gen-AI Explanation — Claude] reconciliation result → human-readable explanation string
  → [Write-back] canonical JSON → stateHash → updateIdentityState() tx on Sepolia (idempotent)
  → [Cache update] mirror final state into SQLite
  → [REST API] GET /identity/{subject} reads ONLY from SQLite — no chain/AI calls in the hot path
```

**Two distinct AI components — keep separate:**

*Gen-AI extraction* (Claude, per-claim, text→structured; `temperature=0`, forced JSON via tool-use):
```json
{
  "normalized_claim_type": "KYC_VERIFIED",
  "issuer_reputation_signal": "known_mock_institution | unknown_issuer | self_attested",
  "expiration_status": "valid | expired | no_expiry | expiring_soon",
  "revocation_status": "active | revoked",
  "asserted_value": "gold",
  "red_flags": ["issuer unregistered"],
  "extraction_confidence": 0.0
}
```

*ML credibility scoring* (scikit-learn, per-claim, structured numeric features→score). Consumes the extraction JSON plus on-chain contextual features (issuer registered?, claim age, days to expiry, chain, claim type) — never raw text directly. Output: `credibility_score ∈ [0,1]`.

**REST response (`GET /api/v1/identity/{subject}`):**
```json
{
  "subject": "0xABCD...",
  "status": "conflicted",
  "confidence": 0.62,
  "unified_claims": {
    "KYC_VERIFIED": {
      "value": "gold",
      "conflict": true,
      "sources": [
        {"chain": "sepolia", "issuer": "0x1234...", "claim_id": "0x...", "credibility_score": 0.91, "status": "active"},
        {"chain": "polygon-amoy", "issuer": "0x5678...", "claim_id": "0x...", "credibility_score": 0.34, "status": "active"}
      ]
    }
  },
  "explanation": "The KYC_VERIFIED claim from Sepolia issuer 0x1234... (registered, unrevoked, high extraction confidence) scored 0.91, while the Polygon Amoy claim from an unregistered issuer scored 0.34 and asserts a conflicting value. Gap (0.57) exceeds the 0.30 conflict threshold, so the system flags CONFLICTED rather than silently trusting the higher score.",
  "onchain": {
    "chain": "sepolia", "contract": "0x...", "tx_hash": "0x...",
    "block_number": 12345678, "state_hash": "0x...", "version": 3,
    "explorer_url": "https://sepolia.etherscan.io/tx/0x..."
  },
  "updated_at": "2026-08-23T10:15:00Z",
  "cache": true
}
```

Other endpoints: `GET /api/v1/health`, `POST /api/v1/reconcile/{subject}` (runs the pipeline synchronously on demand — used to control timing during the live demo instead of waiting on the poll interval; explicitly exempt from the 500ms budget since it's the write/trigger path).

---

## 3. ML Model

**Features (~10-12 dims, all structured — never raw text):** `issuer_registered` (0/1), `issuer_reputation_signal` (one-hot), `claim_age_days`, `days_to_expiry`, `is_expired` (0/1), `is_revoked` (0/1), `red_flag_count`, `extraction_confidence`, `chain_id` (one-hot), `claim_type` (one-hot).

**Algorithm:** `RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)`, use `predict_proba` for the "credible" class as the continuous score. Chosen over logistic regression to capture interaction effects (unregistered + revoked compounds worse than either alone) while exposing `feature_importances_` for the defense.

**Synthetic training data (no real historical dataset exists — required, must be explained clearly in defense):**
1. `numpy.random.seed(42)` — reproducible.
2. Sample each feature from a plausible distribution (e.g. `issuer_registered ~ Bernoulli(0.7)`, `red_flag_count ~ Poisson(0.5)`, `extraction_confidence ~ Beta(8,2)`, `days_to_expiry` mixture including negatives for expired claims).
3. Hand-authored ground-truth formula, kept independent of what the model will learn: `raw_score = 0.35*issuer_registered + 0.25*(1-is_revoked) + 0.15*(1-is_expired) + 0.15*extraction_confidence − 0.10*(red_flag_count/4) + reputation_bonus`; add Gaussian noise, threshold at 0.5, flip ~5% of labels randomly (avoid trivially separable data).
4. `train_test_split(..., stratify=y, random_state=42, test_size=0.2)`.
5. Train, evaluate accuracy + confusion matrix on the held-out 20%; target >75% (expect ~85-92% given the noise level, but report the actual run number, not an assumed one).
6. `joblib.dump(model, "backend/app/ml/model.joblib")` — trained once at build time; FastAPI loads it at startup and only calls `.predict_proba()` at inference, never retrains per-request.

**Defense framing:** constraint explicitly rules out real historical data and permits synthetic generation; the generating formula is independent of the model, noise keeps the task non-trivial, and the held-out accuracy is reproducible from a fixed seed — a bootstrapping strategy pending real outcome data, not a permanent design choice.

---

## 4. Reconciliation Algorithm

Deterministic, rule-based, arithmetic only — no ML inside reconciliation. Nondeterminism is confined entirely to the two upstream Claude calls (mitigated with `temperature=0`) and the ML model (`random_state=42`); reconciliation itself is 100% reproducible given the same scored claims.

Constants (`reconciliation/config.py`): `CONFLICT_THRESHOLD = 0.30`, `VERIFIED_MIN_CONFIDENCE = 0.60`.

Per `claimType` group (all claims of that type for a subject, across both chains):
1. **Single claim:** `status = verified` if `credibility_score >= 0.60` else `insufficient`; `confidence = credibility_score`.
2. **Multiple claims, values agree:** `confidence = (score_1² + score_2²) / (score_1 + score_2)` (weighted average rewarding two independently high-scoring claims agreeing more than two low-scoring ones); `status = verified` if `confidence >= 0.60` else `insufficient`.
3. **Values disagree:** `gap = |score_high − score_low|`.
   - `gap >= CONFLICT_THRESHOLD`: `status = conflicted`, `unified_value` = higher-scoring claim's value (flagged `conflict: true`, never silently trusted), `confidence = score_high * (1 − gap)`.
   - `gap < CONFLICT_THRESHOLD`: `status = conflicted`, `confidence = min(score_high, score_low)` (can't confidently resolve near-equal, disagreeing sources).
4. **Revocation hard override:** any claim in the group revoked (with high extraction confidence) forces that claimType's `status = revoked`, regardless of the above — revocation is categorical, not probabilistic.
5. **Subject-level rollup:** overall `status` = worst status across claim types, priority `revoked > conflicted > insufficient > verified`; overall `confidence` = mean of per-type confidences. (MVP demo exercises one claimType, e.g. `KYC_VERIFIED`, to keep the narrative simple; algorithm generalizes to N types.)

---

## 5. Repo Structure

```
chainmind-synapse/
├── prd.md, research-existing-solutions.md, README.md, .env.example, .gitignore
├── contracts/                          # Foundry project
│   ├── foundry.toml
│   ├── src/ClaimRegistry.sol
│   ├── src/IdentityStateRegistry.sol
│   ├── script/DeployClaimRegistry.s.sol
│   ├── script/DeployIdentityStateRegistry.s.sol
│   ├── script/SeedClaims.s.sol         # mock-issuer conflicting claims for demo
│   ├── test/ClaimRegistry.t.sol
│   ├── test/IdentityStateRegistry.t.sol
│   └── lib/                            # forge-std
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py                     # FastAPI entrypoint, router mounting
│       ├── config.py                   # pydantic-settings: RPC URLs, contract addrs/ABIs, keys
│       ├── api/routes_identity.py      # GET /identity/{subject}, POST /reconcile/{subject}, /health
│       ├── chain/web3_clients.py       # web3.py instances (Sepolia, Amoy)
│       ├── chain/abis/                 # ClaimRegistry.json, IdentityStateRegistry.json (forge build output)
│       ├── chain/ingest.py             # event polling, per-chain last-block cursor
│       ├── chain/writeback.py          # updateIdentityState tx build/send/confirm/retry
│       ├── genai/extraction.py         # Claude call #1
│       ├── genai/explanation.py        # Claude call #2
│       ├── genai/prompts/extraction_system_prompt.txt
│       ├── genai/prompts/explanation_system_prompt.txt
│       ├── ml/features.py              # feature vector construction
│       ├── ml/model.joblib             # trained artifact (committed)
│       ├── ml/score.py                 # load-once + predict_proba wrapper
│       ├── reconciliation/config.py    # thresholds
│       ├── reconciliation/reconcile.py # §4 algorithm
│       ├── reconciliation/canonical.py # canonical JSON + keccak256 stateHash
│       ├── cache/db.py, cache/models.py# raw_claims, identity_state_cache, ingest_cursor tables
│       └── pipeline/orchestrator.py    # glues the whole flow; background loop + sync trigger
│   └── tests/
│       ├── test_reconcile.py           # conflict/agree/revocation-override cases
│       ├── test_canonical_hash.py      # determinism assertions
│       └── test_ml_features.py
├── ml/                                  # offline/build-time training
│   ├── generate_synthetic_data.py
│   ├── train_model.py                  # trains, evaluates, reports accuracy, writes model.joblib
│   └── data/synthetic_claims.csv       # checked in for reproducibility
├── scripts/
│   ├── seed_demo_claims.py             # web3.py version for live-demo seeding
│   ├── verify_state.py                 # independent recompute of stateHash from public chain data only
│   └── demo_walkthrough.md             # exact commands for the video recording
└── docs/architecture.md                # this file
```

SQLite cache tables (explicitly cache, not source of truth):
- `raw_claims(claim_id PK, chain, subject, issuer, claim_type, metadata, issued_at, expires_at, status, credibility_score, extraction_json, block_number, tx_hash)`
- `identity_state_cache(subject PK, status, confidence, unified_claims_json, explanation, state_hash, version, tx_hash, chain, block_number, updated_at)`
- `ingest_cursor(chain PK, last_block_processed)`

---

## 6. Parallel Work Breakdown (2-4 people)

Tracks: **A** contracts+deployment, **B** ingestion+ML+write-back, **C** Gen-AI extraction/explanation+reconciliation, **D** REST API+integration+demo.
- 3 people: merge A into B.
- 2 people: Person 1 = A+B, Person 2 = C+D.

**Hour 0–0.5 (all hands):** lock the three JSON schemas (extraction output §2, canonical state JSON §1, REST response §2) before splitting up — everything downstream depends on these shapes. Create Alchemy apps for both networks, wire the Anthropic key, fund 3+ testnet wallets from Sepolia/Amoy faucets immediately (faucets are the likeliest early bottleneck).

**Hour 0.5–2.5 (parallel):**
- **A:** write+test both contracts, deploy to local Anvil first, then to Sepolia+Amoy via `forge script --broadcast`. Deliver addresses+ABIs to `backend/app/chain/abis/` by hour 2.5.
- **B:** (no contract dependency yet) build `generate_synthetic_data.py` + `train_model.py`, get `model.joblib` trained and validated >75% first; then scaffold web3.py clients, SQLite schema, event-polling skeleton against Anvil.
- **C:** write+lock Claude extraction prompt against hand-written sample claims (no chain dependency), build reconciliation algorithm + unit tests (agree/disagree/revocation-override cases).
- **D:** scaffold FastAPI app + Pydantic models matching the locked schemas, stub `GET /identity/{subject}` with mock data so B/C can integrate incrementally, start the demo storyboard.

**Hour 2.5 — Sync 1:** contracts live on both testnets with addresses shared; ML model trained & committed; reconciliation unit-tested; API skeleton running.

**Hour 2.5–4 (parallel):**
- **A:** run `SeedClaims`/`seed_demo_claims.py` to seed intentionally conflicting demo claims on both chains; verify contracts via `forge verify-contract` (supports the verifiability story).
- **B:** wire real event ingestion against deployed contracts, real ML scoring in the pipeline, implement `writeback.py` (send tx, wait for receipt, retry-safe by design).
- **C:** wire real Claude calls (extraction + explanation) into the pipeline; finalize `canonical.py` hashing; co-own `orchestrator.py` with B (assign one owner to avoid merge conflicts).
- **D:** wire `GET /identity/{subject}` to the real cache, add `POST /reconcile/{subject}`, run a full local loop against Anvil.

**Hour 4 — Sync 2 (critical checkpoint):** one full end-to-end run on the real testnets — seed → ingest → extract → score → reconcile → write `updateIdentityState` on Sepolia → confirm on Etherscan → hit the REST API → see conflicted status + explanation. This is the "fix bugs now" gate.

**Hour 4–5:** bug fixing/polish; if time remains, bonus scope in PRD priority order — (1) revocation detection (call `revokeClaim`, re-run pipeline, show status flip to `revoked`), (2) explanation layer (already built above, not deferred), (3) live dashboard only if hours 4–5 finish early.

**Hour 5–5.5:** record the 3-minute demo video (script in §8), one driver, rest watch for issues.

**Hour 5.5–6:** README + `docs/architecture.md` polish for the defense, final smoke test of the live API, buffer.

---

## 7. Non-Functional Requirements — How They're Met

- **API < 500ms:** `GET /identity/{subject}` reads *only* from SQLite — never calls web3.py or Claude synchronously. All chain/AI work happens in the background pipeline or in `POST /reconcile` (explicitly exempt — the write/trigger path, not the read path).
- **On-chain update < 2min:** ingestion poll ~15-30s + Claude extraction ~5s + Claude explanation ~5s + ML inference <10ms + tx submit and 1 confirmation on Sepolia/Amoy ~5-15s ≈ 55s worst case. Documented budget:

  | Stage | Time |
  |---|---|
  | Ingestion poll interval | ~15-30s |
  | Claude extraction | ~5s |
  | Claude explanation | ~5s |
  | ML inference | <10ms |
  | Tx submit + 1 confirmation | ~5-15s |
  | **Total worst case** | **~55s (well under 2min)** |

- **Determinism/idempotency:** content-hash-keyed writes (`stateHash`) with a no-op-not-revert guard, monotonic `version`, nonce-based idempotent claim issuance, `random_state=42` for the ML model, `temperature=0` for Claude extraction, canonical JSON (sorted keys, integer bps not floats). `backend/tests/test_canonical_hash.py` asserts reordered-but-equal inputs hash identically.
- **Third-party verifiability:** both contracts verified on Etherscan/Polygonscan via `forge verify-contract`. `scripts/verify_state.py` is standalone — pulls raw claims from both `ClaimRegistry` contracts via public RPC only, recomputes canonical JSON + `stateHash`, and compares against the on-chain `IdentityStateRegistry` value. This is the strongest artifact for "how do we know you didn't fake this."

---

## 8. Demo Script (3 minutes)

- **0:00–0:20** Problem statement + architecture diagram.
- **0:20–0:50** Seed conflicting claims: issuer A on Sepolia issues `KYC_VERIFIED: gold`; issuer B on Amoy issues a conflicting/revoked claim for the same subject — show both tx hashes/explorer links.
- **0:50–1:20** Ingestion logs: pipeline picks up both `ClaimIssued` events, prints raw claim data.
- **1:20–1:50** Gen-AI extraction output for both claims.
- **1:50–2:10** ML credibility scores (e.g. 0.91 vs 0.34) + brief note on feature importances.
- **2:10–2:35** Reconciliation result + on-chain write: "CONFLICT DETECTED, confidence=0.64" → `updateIdentityState` tx → cut to Etherscan showing confirmed tx with `stateHash`/`confidenceBps`/`status`.
- **2:35–2:55** Live REST API call showing the unified JSON with sources, confidence, and Gen-AI explanation.
- **2:55–3:00** Closing line on verifiability (`verify_state.py` recomputes the hash independently) + repo link.

---

## Verification

- `forge test` — contract unit tests pass (issuance, revocation, idempotent state updates, no-op-on-same-hash).
- `pytest backend/tests` — reconciliation algorithm cases (agree/disagree/revocation-override), canonical-hash determinism, ML feature construction.
- `python ml/train_model.py` — prints held-out accuracy; confirm it's >75% (target from PRD NFR).
- Full manual end-to-end run against Anvil first, then against live Sepolia+Amoy (Hour 4 sync checkpoint): seed claims → ingest → extract → score → reconcile → on-chain write → confirm via block explorer → `GET /api/v1/identity/{subject}` returns correct conflicted/verified status with sources and explanation.
- `python scripts/verify_state.py <subject>` — independently recomputes the state hash from public chain data and confirms it matches on-chain `IdentityStateRegistry`.
- Time the `GET /identity/{subject}` response to confirm <500ms.
