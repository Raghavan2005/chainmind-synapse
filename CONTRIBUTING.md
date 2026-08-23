# Contributing

The living spec is HTML in [`instructions/`](instructions/INDEX.html). Read [`instructions/CLAUDE.html`](instructions/CLAUDE.html) before writing code. Do not add a second Markdown spec tree (`docs/ARCHITECTURE.md`, `PLAN.md`, …).

1. Open `instructions/INDEX.html` for reading order.
2. Keep the FR-01 pair as Sepolia (`11155111`) + Unichain Sepolia (`1301`). Extra Superchain L2s are optional watched sources.
3. Do not wrap Trusta, Nomis, or Human Passport. Do not fine-tune. Do not put a hosted database on the critical path.
4. If a locked decision must change, update every affected `instructions/*.html` page in the same commit and say so in the commit message.

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git --shallow && forge test -vv && cd ..
pytest
python -m services.score.train
cd dashboard && npm ci && npm run build
```
