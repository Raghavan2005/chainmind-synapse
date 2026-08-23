# Architecture & Decisions Log (decision.md)

This document explains every major engineering and design choice made in **ChainMind Synapse**. It is written in simple, beginner-friendly English so that any developer or student can understand **what** was built, **why** it was built this way, and **what tradeoffs** were accepted.

---

## 1. Mathematical Model: Jøsang Subjective Logic vs. Simple Averages

### The Problem:
When you collect identity information from multiple blockchains (like Ethereum Sepolia and Polygon Amoy), issuers sometimes give contradictory information. For example, one issuer says you are verified (`+1`), but another issuer says your credentials were revoked (`-1`).

If you use a simple average:
$$\text{Average} = \frac{1 + (-1)}{2} = 0$$
The system thinks the result is "middle of the road", confusing **intense disagreement (conflict)** with **having no information at all (uncertainty)**.

### The Chosen Solution: Jøsang Subjective Logic
Instead of a single average number, we represent an opinion using three parts:
- **Belief ($b$)**: How much solid evidence supports the person.
- **Disbelief ($d$)**: How much solid evidence rejects the person.
- **Uncertainty ($u$)**: How much information is completely missing.

These three numbers always add up to 1:
$$b + d + u = 1$$

### Definitions of Key Terms:
- **Epistemic Uncertainty**: Uncertainty caused by a lack of data. When you have zero claims, uncertainty is $100\%$ ($u = 1.0$).
- **Conflict Mass ($K$)**: A penalty metric calculated when two issuers directly disagree ($b_1 \cdot d_2 + d_1 \cdot b_2$). When conflict spikes, the system reduces the final confidence score instead of guessing.
- **Basis Points (bps)**: A unit of measurement where $1\% = 100\text{ bps}$. A score of $0.41$ confidence is written as $4100\text{ bps}$.

### Why We Rejected Naive Averages:
A simple average produces **false certainty**. Jøsang Subjective Logic ensures that if two banks disagree about your identity, the system honestly reports: *"We have high conflict, so we cannot verify this person with high confidence."*

### Tradeoff Accepted:
Calculating pairwise conflict between every pair of claims takes a few extra CPU cycles ($O(N^2)$ math), which is completely negligible for small claim sets ($N < 50$).

---

## 2. Frontend Architecture: Vanilla JavaScript Modules vs. Heavy Frameworks

### The Problem:
We needed an interactive, real-time dashboard that runs particle animations and ternary triangle coordinate updates at 60 frames per second without stuttering.

### The Chosen Solution: Vanilla ES Modules & HTML5 Canvas
- We used standard JavaScript (`import` and `export`) directly supported by all modern browsers.
- We used native HTML5 2D Canvas contexts for high-speed particle simulation.

### Why We Rejected Frameworks like React / Next.js / Vite:
- **Zero Build Step**: No `npm run build` or Webpack bundling required. You can edit a file and immediately refresh the browser.
- **Zero Framework Overhead**: React state re-renders can cause canvas animation stutters. Direct JavaScript canvas drawing runs smoothly at 60 FPS.
- **Simple Deployment**: Runs on any lightweight static server (e.g. `uv run python -m http.server 3000`).

### Tradeoff Accepted:
We wrote explicit DOM event listeners in `js/app.js` instead of using JSX tags.

---

## 3. UI Theme: Institutional Neutral Slate vs. Flashy Neon

### The Problem:
Many Web3 dashboards use distracting rainbow neon colors, large 3D glowing spheres, and dark purple gradients. This makes it difficult to read cryptographic hashes and understand conflict alerts.

### The Chosen Solution: Professional Institutional Neutral Palette
- **Surfaces**: Titanium slate and deep charcoal (`#090b0e`, `#11141a`, `#171b23`).
- **Typography**: Clean chalk white (`#ffffff`) for high contrast, paired with **Plus Jakarta Sans** for UI text and **Space Mono** for numbers and hashes.
- **Hairline Dividers**: Subtle translucent borders (`rgba(255, 255, 255, 0.07)`).

### Tradeoff Accepted:
The interface looks like an institutional financial terminal (like Bloomberg or Stripe) rather than a colorful video game.

---

## 4. On-Chain State Fingerprint: Keccak256 State Hash Commitment

### The Problem:
How does a smart contract or third-party app verify that the trust score displayed on the dashboard was legitimately computed and not altered?

### The Chosen Solution: Cryptographic Preimage Hashing
We calculate a single 32-byte cryptographic fingerprint (`stateHash`) using Ethereum's standard hashing algorithm (`keccak256`):
$$\text{stateHash} = \text{keccak256}(\text{subject}, \text{claimsRoot}, \text{scoreBps}, \text{modelVersion}, \text{issuedAt})$$

### Definition of Key Terms:
- **Preimage**: The original raw data inputs (subject address, claim IDs, score in basis points, and timestamp) before they are hashed.
- **Cryptographic Hash**: A one-way mathematical function that turns data into a unique string of letters and numbers (`0x...`). If even a single letter in the input changes, the hash changes completely.

### Tradeoff Accepted:
All preimage data must be formatted in strict alphabetical order so that both JavaScript and Python (`verify_hash.py`) produce the exact same hash.
