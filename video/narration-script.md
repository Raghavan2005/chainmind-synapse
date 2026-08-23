# ChainMind Synapse — narration script

For ElevenLabs (or any TTS). Matches `video/index.html`'s 7 scenes exactly — same timing, same on-screen data. ~2.5 words/sec pacing, so the read should land a beat or two before each scene cut, not run over it.

Voice suggestion: calm, direct, mid-register — a systems engineer explaining something real, not a hype narrator. Avoid an upward "product demo" lilt on the numbers.

---

## Scene 1 — 0:00–0:20 (target ~45 words)

> Two blockchains. One person. Two different answers about who they are.
>
> When a credential from one chain doesn't match a claim on another, most systems just... don't notice. There's no shared source of truth.
>
> This is Chain Mind Synapse. It watches both chains, and it does not let a conflict hide.

---

## Scene 2 — 0:20–0:40 (target ~45 words)

> A few rules, non-negotiable. No identity provider sits in the middle. No centralized database holds the real state — the chain does.
>
> Sepolia and Unichain Sepolia, both real public testnets. Goerli and Mumbai, the ones the original brief named, have been dead since twenty twenty four.
>
> Every score comes from an actual model, not a prompt guessing a number.

---

## Scene 3 — 0:40–1:10 (target ~70 words)

> Here's the fixture. Two issuers, same subject, same claim — "kyc dot adult" — and opposite answers.
>
> On Sepolia, issuer one says yes, this person is verified. Plus one.
>
> On Unichain Sepolia, a different issuer says no. Minus one.
>
> Both of these are real transactions, signed and confirmed on their own chain, seconds apart. Not simulated. You can open either one on its explorer right now.

---

## Scene 4 — 1:10–1:50 (target ~95 words)

> Now the system goes to work. A watcher process picks up both events, scores each claim with a trained model, and fuses the result.
>
> This is the actual log output — nothing staged, nothing replayed. Ingest, score, conflict detected, commit sent, commit mined.
>
> The credibility model holds ninety percent accuracy on held-out data, with an F1 score of zero point nine one one.
>
> And the whole loop — from the second claim landing on-chain, to a new fused state committed back to Sepolia — took thirty nine seconds. Our budget was two minutes.

---

## Scene 5 — 1:50–2:20 (target ~65 words)

> The fused result doesn't live in a database somewhere. It's committed on-chain as a hash — subject, claim set, score, all baked into one commitment, written to Sepolia.
>
> And because it's just a hash, anyone can check it. Pull the same public logs, recompute the hash yourself, and compare it to what's on-chain.
>
> That's what this verification script does. And it says: ok.

---

## Scene 6 — 2:20–2:45 (target ~55 words)

> The system never hides the losing side. Both claims stay listed. The banner says exactly what happened — conflict on "kyc dot adult," both sides stay listed.
>
> And it explains itself. Issuer reputation pulled the score down. Conflict count pulled it down further. These aren't vibes — they're named features from the actual model.

---

## Scene 7 — 2:45–3:00 (target ~35 words)

> We didn't wrap Passport or Trusta — this fuses conflicting evidence itself, honestly.
>
> What's next: status lists, a real issuer trust graph, labeled data instead of synthetic.
>
> Chain Mind Synapse. Claims, not vibes.

---

## Full script, no scene labels (paste this block into ElevenLabs)

Two blockchains. One person. Two different answers about who they are.

When a credential from one chain doesn't match a claim on another, most systems just don't notice. There's no shared source of truth.

This is Chain Mind Synapse. It watches both chains, and it does not let a conflict hide.

A few rules, non-negotiable. No identity provider sits in the middle. No centralized database holds the real state — the chain does.

Sepolia and Unichain Sepolia, both real public testnets. Goerli and Mumbai, the ones the original brief named, have been dead since twenty twenty four.

Every score comes from an actual model, not a prompt guessing a number.

Here's the fixture. Two issuers, same subject, same claim — kyc dot adult — and opposite answers.

On Sepolia, issuer one says yes, this person is verified. Plus one.

On Unichain Sepolia, a different issuer says no. Minus one.

Both of these are real transactions, signed and confirmed on their own chain, seconds apart. Not simulated. You can open either one on its explorer right now.

Now the system goes to work. A watcher process picks up both events, scores each claim with a trained model, and fuses the result.

This is the actual log output — nothing staged, nothing replayed. Ingest, score, conflict detected, commit sent, commit mined.

The credibility model holds ninety percent accuracy on held-out data, with an F1 score of zero point nine one one.

And the whole loop — from the second claim landing on-chain, to a new fused state committed back to Sepolia — took thirty nine seconds. Our budget was two minutes.

The fused result doesn't live in a database somewhere. It's committed on-chain as a hash — subject, claim set, score, all baked into one commitment, written to Sepolia.

And because it's just a hash, anyone can check it. Pull the same public logs, recompute the hash yourself, and compare it to what's on-chain.

That's what this verification script does. And it says: ok.

The system never hides the losing side. Both claims stay listed. The banner says exactly what happened — conflict on kyc dot adult, both sides stay listed.

And it explains itself. Issuer reputation pulled the score down. Conflict count pulled it down further. These aren't vibes — they're named features from the actual model.

We didn't wrap Passport or Trusta — this fuses conflicting evidence itself, honestly.

What's next: status lists, a real issuer trust graph, labeled data instead of synthetic.

Chain Mind Synapse. Claims, not vibes.
