# Real OS screen reader & audio capture — assessment

Future item ④ from [`docs/ROADMAP.md`](../ROADMAP.md). Assessed 2026-06-24.

**Decision: documented as future, not built.** Both halves need runtime, permissions, or infrastructure
that can't be set up or *verified* in this context, and an unverified screen-reader-automation wrapper
would be worse than an honest gap. Items ①–③ (network capture, framework-aware `apply_fix`, the fuller
triage UI) were built and verified; this one is recorded here instead.

## Real OS screen reader (VoiceOver / NVDA via `@guidepup/guidepup`)

`@guidepup/guidepup` (installed transitively via `@guidepup/virtual-screen-reader`) can drive real
VoiceOver/NVDA. Building a capture tied to a page would also need `@guidepup/playwright` and a headed
browser. The blockers:

- **It takes over the machine.** `voiceOver.start()` enables VoiceOver — it speaks the screen aloud and
  captures keyboard input. Triggering that automatically on a developer's machine is disruptive and not
  something to do without explicit, interactive consent.
- **It needs OS permissions.** The controlling process must be granted Accessibility + Automation
  permissions in System Settings; these can't be granted programmatically.
- **It can't run in CI.** GitHub's Linux runners have no VoiceOver/NVDA, so the suite would only ever skip it.
- **So its happy path can't be verified here** without hijacking the host. A wrapper would ship unverified.

The CI-safe, verified middle ground already ships: the **virtual-screen-reader observer**
(`createScreenReaderObserver`) produces a real spoken-phrase transcript in pure Node. A real OS-SR
capture would be a higher-fidelity, opt-in addition for an environment explicitly set up for it
(VoiceOver enabled, permissions granted, headed browser), gated so it never touches the machine by default.

## Audio extraction for caption-accuracy (Tier 5)

Judging whether a video's captions match its soundtrack needs an audio→text pipeline: extract the audio
track, transcribe it with an ASR model (e.g. Whisper), then align and compare against the caption track.
That's a substantial, specialized subsystem. Until it exists, Tier-5 caption-accuracy stays **advisory** —
it can flag missing or empty captions but never certify accuracy (UNKNOWN/advisory, never PASS), which is
the correct posture.

## What ships instead

The seams are already in place for when the heavier capture is added: the virtual screen reader for SR
output, and the Tier-5 advisory guard for caption-accuracy. Building either capability now would mean
unverifiable, environment-bound code — so it is documented here and in the ROADMAP's Future section.
