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

Grounding evidence is not routed to a judge; it grounds the conversational `explain()` surface and makes a run reproducible. Naming-relevant capture (the Tier-1 wedge) lives in the dedicated `naming` observer, and Tier-2 screenshots are captured per element by `captureVision` — so the generic screenshot/image/styles observers below stay deferred rather than re-capture the whole page on every run.

| Observer | Provides | Tiers | Status |
| --- | --- | --- | --- |
| DOM | rendered HTML structure + attributes | 1, 3 | **Real** — `domObserver` |
| Accessibility tree | roles, names, states | 1, 3 | **Real** — `a11yTreeObserver` |
| Screenshot | element + context crops | 1, 2 | Deferred — per-element `captureVision` is the live Tier-2 path |
| Image | extracted image bytes for OCR | 1, 2 | Deferred — `naming` covers `img` alt; vision handles bytes |
| Styles | computed color/contrast/visibility | 2 | Deferred — element-targeted, captured with the targeted checks |
| Network | request/response correlation | 3 | Deferred — needs CDP / network-event listening |
| Virtual screen reader | spoken-phrase transcript (jsdom, CI-safe) | 1, 3 | **Real, opt-in** — `createScreenReaderObserver`, not in the default set (a full traversal per capture is heavy) |
| Real screen reader (OS) | high-fidelity announcements via the OS | 3 | Future — OS-level automation (@guidepup) |

## Driver seam

Observers depend on the `Driver` interface, not on Playwright directly (`eval`, `screenshot`, `snapshotDom`, `snapshotA11yTree`, `extractImage`, `computedStyle`, `cdp`, `focusedElement`). Playwright is the only implementation today; the seam keeps "framework-agnostic" honest without speculative second drivers.
