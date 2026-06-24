import {
  type Clock,
  type Driver,
  type EvidenceRecord,
  type EvidenceWindow,
  type GroundingPayload,
  type Interaction,
  type Observer,
  type ObserverContext,
  SCHEMA_VERSION,
} from "@aee/core";

/**
 * Stub grounding observer for capture that isn't wired yet. It yields no evidence,
 * which downstream produces UNKNOWN — never a guessed PASS. Each remaining stub below
 * carries a note for WHY it's deferred (the real capture lives elsewhere or needs more infra).
 */
function stubObserver(name: string): Observer {
  return {
    name,
    async init(_ctx: ObserverContext): Promise<void> {},
    async beforeInteraction(_i: Interaction): Promise<void> {},
    async collect(_i: Interaction, _window: EvidenceWindow): Promise<EvidenceRecord[]> {
      return [];
    },
    async dispose(): Promise<void> {},
  };
}

/**
 * Real page-level grounding observer. Captures one whole-page snapshot (the rendered DOM
 * or the accessibility tree) via the injected Driver — the only seam to the live page — and
 * emits a single grounding EvidenceRecord. The evidence is not routed to a judge; it grounds
 * the conversational `explain()` surface and makes a run reproducible.
 *
 * With no driver (e.g. `collect` called without `init`) or on a capture failure it yields no
 * evidence: observer isolation, never a crash, never a guessed PASS. `dispose` clears the
 * captured driver so a stray post-run `collect` also degrades safely.
 */
function groundingObserver(
  name: string,
  kind: GroundingPayload["kind"],
  snapshot: (driver: Driver) => Promise<unknown>,
): Observer {
  let driver: Driver | undefined;
  let clock: Clock | undefined;
  return {
    name,
    async init(ctx: ObserverContext): Promise<void> {
      driver = ctx.driver;
      clock = ctx.clock;
    },
    async beforeInteraction(_i: Interaction): Promise<void> {},
    async collect(i: Interaction): Promise<EvidenceRecord[]> {
      if (!driver || !clock) return [];
      let text: string;
      try {
        text = String(await snapshot(driver));
      } catch {
        return []; // observer isolation: no evidence on failure, never a crash
      }
      return [
        {
          schemaVersion: SCHEMA_VERSION,
          interactionId: i.id,
          at: clock.now(),
          observer: name,
          before: null,
          after: { kind, snapshot: text, length: text.length } satisfies GroundingPayload,
          changes: [],
          confidence: "high",
          source: "observed",
        },
      ];
    },
    async dispose(): Promise<void> {
      driver = undefined;
      clock = undefined;
    },
  };
}

// Real page-level grounding: the rendered DOM and the accessibility tree (what AT exposes).
export const domObserver = groundingObserver("dom", "dom", (d) => d.snapshotDom());
export const a11yTreeObserver = groundingObserver("a11y-tree", "a11y-tree", (d) =>
  d.snapshotA11yTree(),
);

// Deferred grounding — honest stubs; the real capture lives elsewhere or needs more infra:
// - screenshot / image: captured per-element by @aee/playwright's captureVision (the actual
//   Tier-2 vision path). A full-page screenshot on every capture would bloat each run for no
//   judged signal, so it is not wired into the default grounding set.
// - styles: computed styles are element-targeted, captured alongside the targeted checks.
// - network: requires CDP / network-event listening across a navigation, not a one-shot collect.
export const screenshotObserver = stubObserver("screenshot");
export const imageObserver = stubObserver("image");
export const stylesObserver = stubObserver("styles");
export const networkObserver = stubObserver("network");
/** Deterministic, CI-safe (default). A real-SR observer is opt-in/gated later (see roadmap). */
export const virtualScreenReaderObserver = stubObserver("virtual-screen-reader");

/** Default grounding observers fed to the runner: real DOM + a11y-tree; deferred capture as stubs. */
export const groundingObservers: Observer[] = [
  domObserver,
  a11yTreeObserver,
  screenshotObserver,
  imageObserver,
  stylesObserver,
  networkObserver,
  virtualScreenReaderObserver,
];

export { createNamingObserver } from "./naming.js";
