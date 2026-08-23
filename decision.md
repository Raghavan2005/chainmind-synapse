# Architectural & Engineering Decisions Log (decision.md)

This log documents every architectural, algorithmic, and design decision made during the development of **ChainMind Synapse**, detailing the rationale, tradeoffs evaluated, and normative alignment with [`instructions/`](instructions/INDEX.html).

---

## 1. Mathematical Model: Jøsang Subjective Logic vs. Simple Bayesian Average

- **Decision**: Implemented Jøsang Cumulative Fusion ($\oplus$) with Beta opinion mapping $(\omega = (b, d, u, a))$ and pairwise conflict penalties $K_{ij} = b_i d_j + d_i b_j$ over simple weighted averages or naive probabilities.
- **Why**:
  - In multi-chain identity reconciliation, evidence from different issuers can directly contradict (e.g. Sepolia affirms `kyc.adult = +1`, Polygon Amoy affirms `kyc.adult = -1`).
  - Standard Bayesian averaging conflates *high conflict* with *high uncertainty* (both end up near $p = 0.5$).
  - Jøsang Subjective Logic explicitly decouples **Uncertainty ($u$)** from **Conflict Mass ($K$)**, preventing false certainty when conflicting claims are presented.
- **Tradeoff Accepted**: Slightly higher computational complexity ($O(N^2)$ pairwise conflict calculation), which is negligible for identity claim sets ($N < 50$).

---

## 2. Frontend Technology: Vanilla ES Modules & HTML5 Canvas vs. Heavy SPA Frameworks

- **Decision**: Built the watch floor using standard Vanilla JavaScript (ES Modules `import/export`), Native CSS Custom Properties, and HTML5 2D Canvas contexts instead of React/Next.js/Vite bundles.
- **Why**:
  - **Zero Compilation Latency**: Runs natively in any modern browser via lightweight HTTP server (`python -m http.server`).
  - **Direct Canvas Physics Control**: 60 FPS requestAnimationFrame loops for particle flow and barycentric triangle math without React reconciliation overhead.
  - **Spec Compliance**: Matches the direct deliverable requirements in [`instructions/PLAN.html`](instructions/PLAN.html) and [`instructions/DESIGN.html`](instructions/DESIGN.html).
- **Tradeoff Accepted**: Manual DOM event binding in [`js/app.js`](js/app.js) instead of JSX declarative state bindings.

---

## 3. UI Design System: Institutional Neutral Slate & Modern Typography

- **Decision**: Adopted an institutional neutral palette (Deep Titanium Slate `#090b0e` $\to$ `#171b23`, Pure White `#ffffff`, Cool Slate `#94a3b8`) paired with **Plus Jakarta Sans** and **Space Mono**.
- **Why**:
  - Replaces distracting rainbow gradients and high-saturation neon with an institutional-grade, high-density dashboard suitable for real-time compliance and security audits.
  - `Plus Jakarta Sans` provides high legibility at density, while `Space Mono` ensures tabular alignment for cryptographic hashes (`stateHash`, `commitId`), block heights, and basis point scores (`scoreBps`).
- **Tradeoff Accepted**: Strict restraint on color accents; status indicators rely on border weights, typography contrast, and subtle monochrome fills.

---

## 4. On-Chain State Commitment Formula Matching `verify_hash.py`

- **Decision**: Modeled the state hash commitment strictly following:
  $$\text{stateHash} = \text{keccak256}(\text{abi.encode}(\text{subject}, \text{claimsRoot}, \text{scoreBps}, \text{modelVersion}, \text{issuedAt}))$$
- **Why**:
  - Guarantees deterministic cryptographic preimages that can be verified off-chain via Python (`verify_hash.py`) and settled on-chain via EVM smart contracts on Sepolia (Chain ID `11155111`).
- **Tradeoff Accepted**: Strict field ordering required in preimage JSON generation.

---

## 5. Branching Strategy: Feature Branch & PR Merge Workflow

- **Decision**: Developed on `feature/interactive-frontend`, pushed to GitHub remote `origin`, and merged via Pull Request #15 into `master`.
- **Why**:
  - Follows industry pair-programming standards, ensuring an immutable audit trail of changes, automated CI checks, and clean git history on `master`.
