# Observer lifecycle

Observers are the only components that touch the live page. They exist to feed the AI grounded evidence and to power Tier-3 dynamic checks.

## Lifecycle

```
register → init(ctx) → [ per checkpoint:  beforeInteraction → (settle) → collect ] → dispose
```

- **`init(ctx)`** — one-time setup (e.g. attach a CDP session, start the virtual screen reader). Receives the `Driver` and run context.
- **`beforeInteraction(i)`** — capture the "before" baseline for interaction `i`.
- **settle** — the orchestrator waits on the `SettleStrategy` (DOM-idle + network-idle + announcement-drained, with timeouts) before collecting "after".
- **`collect(i, window)`** — return `EvidenceRecord[]` for this interaction/window. Heavy artifacts are written to the store and referenced by `ArtifactRef`.
- **`dispose()`** — tear down sessions.

## Failure isolation

An observer that throws (CDP drops, SR session dies) must **not** abort the run or other observers. Its contribution degrades to *no evidence*, which downstream causes judges to return `UNKNOWN` — never a crash, and never a silent `PASS`.

## Grounding observers (the evidence the AI needs)

| Observer | Provides | Used by tiers |
| --- | --- | --- |
| DOM | structure, attributes, accessible name computation inputs | 1, 3 |
| Accessibility tree | roles, names, states | 1, 3 |
| Screenshot | element + context crops | 1, 2 |
| Image | extracted image bytes for alt-text judging / OCR | 1, 2 |
| Styles | computed color/contrast/visibility | 2 |
| Network | request/response correlation | 3 |
| Virtual screen reader | deterministic announcements (default, CI-safe) | 1, 3 |
| Real screen reader | high-fidelity announcements (opt-in, gated) | 3 |

## Driver seam

Observers depend on the `Driver` interface, not on Playwright directly (`eval`, `screenshot`, `snapshotDom`, `snapshotA11yTree`, `extractImage`, `computedStyle`, `cdp`, `focusedElement`). Playwright is the only implementation today; the seam keeps "framework-agnostic" honest without speculative second drivers.
