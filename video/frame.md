---
version: alpha
name: ChainMind Synapse — Frame (video / frame layer)
description: >
  Video-first companion to instructions/DESIGN.html. The unit is the frame (1920×1080). Atoms
  are identical and sacred — near-black ink ground, bone type, oxidized copper as the only
  brand signal, moss for settled/ok, brick for conflict/revoked, amber for pending/degraded.
  Newsreader serif headlines, IBM Plex Sans UI, IBM Plex Mono for every hash / bps / chainId.
  Composition, frame scale, and pacing are free; the tokens below are not.
unit: the frame — 1920×1080, landscape only (this is a screen-recording-style product demo, not a social cutdown)
principle: workstation-dense, warm ink · claims not vibes · never hide the losing side

colors:
  ink: "#0b0d0c"          # page / composition ground
  ink-2: "#121614"        # panels
  ink-3: "#1a1f1c"        # inset / code blocks / terminal
  rule: "#2a322c"         # hairline borders — the ONLY border treatment, 1px, never a shadow
  bone: "#ebe4d4"         # primary text
  bone-dim: "#c4bba8"     # secondary text
  mute: "#8a8476"         # meta / timestamps / captions
  copper: "#c4783a"       # brand / focus ring / belief mass
  copper-2: "#e4a15a"     # hover / scores / emphasis numerals
  moss: "#6f9d7a"         # supported / ok / settled verdict
  moss-2: "#9ec9a6"       # links / explorer references
  danger: "#c45b4a"       # conflict / revoked / disbelief mass
  warn: "#d4a017"         # pending / degraded / emergency-source

typography:
  # — reading ramp (IBM Plex Sans) —
  micro:        { fontFamily: "IBM Plex Sans", px: 12, weight: 500, tracking: "0.16em", upper: true, color: "{colors.mute}" }
  body:         { fontFamily: "IBM Plex Sans", px: 15, weight: 400, lineHeight: 1.5, color: "{colors.bone}" }
  body-dim:     { fontFamily: "IBM Plex Sans", px: 15, weight: 400, lineHeight: 1.5, color: "{colors.bone-dim}" }
  label:        { fontFamily: "IBM Plex Sans", px: 14, weight: 600, lineHeight: 1.4, color: "{colors.bone}" }
  # — mono ramp (IBM Plex Mono) — hashes, bps, chainIds, terminal, JSON. Never any other family for these. —
  mono-chip:    { fontFamily: "IBM Plex Mono", px: 12, weight: 400, tracking: "0.02em" }
  mono-body:    { fontFamily: "IBM Plex Mono", px: 13, weight: 400, lineHeight: 1.6 }
  mono-terminal:{ fontFamily: "IBM Plex Mono", px: 18, weight: 400, lineHeight: 1.5, color: "{colors.bone}" }
  mono-score:   { fontFamily: "IBM Plex Mono", px: 42, weight: 400, color: "{colors.copper-2}" }
  # — display ramp (Newsreader, negative tracking, weight 500) —
  headline:     { fontFamily: "Newsreader", px: 56, weight: 500, tracking: "-0.03em", lineHeight: 1.05, color: "{colors.bone}" }
  headline-lg:  { fontFamily: "Newsreader", px: 88, weight: 500, tracking: "-0.03em", lineHeight: 1.0, color: "{colors.bone}" }

spacing:
  edge: "80px"           # standard frame edge inset
  gap-md: "24px"
  gap-lg: "48px"
  radius: "0px"          # square corners everywhere — no rounded-everything (forbidden default)

components:
  hairline-panel:
    border: "1px solid {colors.rule}"
    background: "{colors.ink-2}"
    radius: "{spacing.radius}"
    description: "The only container treatment. No shadows, no gradients, no glassmorphism."
  chip:
    typography: "{typography.mono-chip}"
    border: "1px solid {colors.rule}"
    padding: "4px 8px"
    description: "Health/status chip (e.g. 'Sepolia 11548462', 'acc 0.90'). Color the text moss/warn/danger per state; border stays {colors.rule}."
  conflict-banner:
    border: "1px solid {colors.danger}"
    typography: "{typography.body}"
    description: "'Conflict on kyc.adult. Both sides stay listed.' Never hide the losing claim."
  opinion-stack:
    layout: "horizontal stacked bar, height 10px"
    segments: "belief={colors.copper}, disbelief={colors.danger}, uncertainty={colors.mute}"
    description: "Jøsang b/d/u visualization. Confidence is a large mono numeral beside it, never a speedometer/gauge."
  terminal:
    background: "{colors.ink-3}"
    typography: "{typography.mono-terminal}"
    description: "Dark, 18pt, no transparency (DESIGN.html is explicit on this). One-line JSON log events, printed as-is — do not restyle ingest/writer log output."
  mark:
    glyph: "◎"
    color: "{colors.copper}"
    description: "The only logo — a copper ring on ink. No brain-plus-chain illustration, ever."

## The Frame

ChainMind Synapse is a two-chain identity-claim reconciler (Sepolia + Unichain Sepolia), not a consumer fintech app and not a neon "AI brain" product. The video should feel like screen-recorded footage from a workstation monitoring real on-chain claims — a watch floor, per the dashboard's own tagline "Claims, not vibes." — not a marketing sizzle reel.

## Do

- Use real data everywhere: real tx hashes, real addresses (truncated 0x + 6…4 with the mono font), real terminal log lines from `demo_flow.sh` / `services.ingest.watch`, real screenshots or recordings of the actual dashboard at `dashboard/` (this project, not a recreation).
- Pretty-print JSON with `jq`. Field order matches `instructions/SCHEMA.html` — verdict, confidence, conflicts stay at the top; humans read those first.
- Keep the conflict banner and the losing claim visible whenever a conflict is on screen. This is the product's entire point — do not stage a demo where one side quietly disappears.
- Cut dead air aggressively. Three minutes is a hard stop (DESIGN.html).

## Don't

- Inter, purple-to-blue gradients, glassmorphism, 3D orbs, "neural network" backgrounds, rainbow chain badges, rounded-everything, stock hero footage, "Unlock the future of identity" copy — all explicitly forbidden in DESIGN.html and equally forbidden here.
- Do not invent a UI that doesn't exist in `dashboard/`. If a shot needs a UI element, either it's really in the dashboard (screen-record it) or it belongs in a terminal/JSON shot instead.
- No continuous pulse/looping "live" animation — DESIGN.html asks for `prefers-reduced-motion` respect; keep motion purposeful, not ambient.
