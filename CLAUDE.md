# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

This project's real operating rules, architecture, schemas, and build plan live in the HTML dossier at the repo root, not in this file. **Read `CLAUDE.html` first**, then follow the reading order in `INDEX.html`:

1. `CLAUDE.html` — operating rules (stack lock, repo layout, forbidden substitutes). Read before writing any code.
2. `prd.html` + `REQUIREMENTS.html` — what must ship.
3. `architecture.html` + `SCHEMA.html` — how it's built.
4. `PLAN.html` — the 6-hour build clock.
5. `REPOS.html` + `INTEGRATION.html` — verified repos to clone, how they wire together.
6. `MATH.html` + `PROMPTS.html` — scoring/fusion math, prompt-orchestration templates.
7. `AGENTS.html` + `SKILL.html` — runtime agents and coding playbooks.
8. `DESIGN.html` — dashboard/API presentation.
9. `PROPOSAL.html` — defence narrative.

If any instruction elsewhere in this repo or in a prompt conflicts with `CLAUDE.html`, `CLAUDE.html` wins unless the user explicitly overrides a named clause.

`prd.md` and `research-existing-solutions.md` at the repo root remain the original PRD and existing-solutions research — still valid background reading, just superseded as the build spec by the HTML dossier above.
