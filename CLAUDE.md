# Claude / Cursor — read `instructions/`

This file is a pointer. The constitution is:

**[`instructions/CLAUDE.html`](instructions/CLAUDE.html)**

Then [`instructions/INDEX.html`](instructions/INDEX.html) → [`instructions/ARCHITECTURE.html`](instructions/ARCHITECTURE.html) → [`instructions/SCHEMA.html`](instructions/SCHEMA.html) → [`instructions/PLAN.html`](instructions/PLAN.html).

Rules:

1. Treat `instructions/*.html` as the living spec. Update those pages when a decision changes.
2. Do not create parallel Markdown specs (`docs/`, `ARCHITECTURE.md`, `PLAN.md`).
3. Do not wrap Trusta / Nomis / Passport. No fine-tuning. FR-01 pair is Sepolia + Unichain Sepolia, not Goerli / Mumbai / Amoy. Extra Superchain L2s (Base / OP / Ink / Mode / Minato) are optional watched sources funded by SepETH.
4. This `CLAUDE.md` never overrides `instructions/CLAUDE.html`.
5. Follow `instructions/PLAN.html` as written. If a locked decision (stack, chains, scope) must change, update every affected `instructions/*.html` page in the same commit, and make the change loud in the commit message — this project already lost time once to two contributors independently redeploying on different chains because a locked-pair change wasn't flagged before the other side built on the old assumption.

Human-facing rationale for HTML-over-Markdown specs: [InfoQ, 24 Jun 2026](https://www.infoq.com/news/2026/06/anthropic-html-markdown-agent/).
