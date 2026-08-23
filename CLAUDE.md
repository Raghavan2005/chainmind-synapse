# Claude / Cursor — read `instructions/`

This file is a pointer. The constitution is:

**[`instructions/CLAUDE.html`](instructions/CLAUDE.html)**

Then [`instructions/INDEX.html`](instructions/INDEX.html) → [`instructions/ARCHITECTURE.html`](instructions/ARCHITECTURE.html) → [`instructions/SCHEMA.html`](instructions/SCHEMA.html) → [`instructions/PLAN.html`](instructions/PLAN.html).

Rules:

1. Treat `instructions/*.html` as the living spec. Update those pages when a decision changes.
2. Do not create parallel Markdown specs (`docs/`, `ARCHITECTURE.md`, `PLAN.md`).
3. Do not wrap Trusta / Nomis / Passport. No fine-tuning. Sepolia + Unichain Sepolia, not Goerli / Mumbai / Amoy.
4. This `CLAUDE.md` never overrides `instructions/CLAUDE.html`.

Human-facing rationale for HTML-over-Markdown specs: [InfoQ, 24 Jun 2026](https://www.infoq.com/news/2026/06/anthropic-html-markdown-agent/).
