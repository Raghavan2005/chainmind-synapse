# ChainMind Synapse

# ChainMind Synapse

Title:
ChainMind Synapse

Background:
In decentralized digital identity systems, users often hold multiple credentials across different blockchains, each with varying validity periods and trust levels. A user’s identity is fragmented across these chains, and no system currently provides a real-time, AI-driven reconciliation of conflicting claims about their identity status.

Problem Statement:
When a user presents a credential from one blockchain to a service provider on another, the provider cannot verify its current validity or detect conflicting claims from other chains. This leads to trust gaps and manual verification overhead. In 6 hours, your team must build a system that ingests real-time credential claims from multiple blockchains, uses AI to assess their credibility, and generates a unified, explainable identity state that is both auditable and tamper-proof.

Scope:
The system must process blockchain identity claims, apply AI-based trust scoring, and produce a unified identity state. It must be deployable on-chain and support real-time updates. The solution must not rely on centralized identity providers.

MVP Scope:
- Ingest identity claims from two blockchain sources (e.g., Ethereum and Polygon) via smart contract events or RPC calls
- Use a Gen-AI agent to analyze claim content and extract trust signals (e.g., issuer reputation, expiration, revocation status)
- Apply an AI-ML model to score each claim’s credibility based on historical data and contextual features
- Store the final identity state on a blockchain ledger with timestamped, immutable records
- Expose a REST endpoint that returns the current identity state and a confidence score

Advanced/Bonus Scope:
- Add support for revocation detection via blockchain event monitoring
- Implement a Gen-AI explanation layer that generates human-readable reasons for trust scores
- Integrate a real-time dashboard showing claim reconciliation over time

Functional Requirements:
- Parse blockchain identity claims from at least two chains
- Extract and normalize claim metadata using Gen-AI prompt engineering
- Train or use a pre-trained AI-ML model to score claim credibility
- Generate a unified identity state with confidence metrics
- Store the final state on-chain with timestamped, immutable records
- Expose a REST API to query the current identity state
- Provide a JSON response with claim sources and trust scores

Non-Functional Requirements:
- API response latency < 500ms under load
- On-chain state update latency < 2 minutes
- AI-ML model accuracy > 75% on test claims
- All blockchain interactions are deterministic and idempotent
- All on-chain records are verifiable by third parties

Constraints:
- Must be built within 6 hours
- All blockchain interactions must be on testnets (e.g., Goerli, Mumbai)
- No use of external identity providers or centralized databases
- All Gen-AI components must use prompt orchestration, not fine-tuning
- AI-ML model must be trained or deployed using existing libraries (e.g., scikit-learn, HuggingFace)
- No use of pre-built identity reconciliation tools or commercial SDKs

Deliverables:
- A working demo of the system on a testnet
- A live API endpoint that returns identity states
- A Gen-AI explanation of the trust decision
- A blockchain transaction showing the final identity state
- A 3-minute demo video showing the full flow
