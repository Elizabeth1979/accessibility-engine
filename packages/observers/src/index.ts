import type {
  EvidenceRecord,
  EvidenceWindow,
  Interaction,
  Observer,
  ObserverContext,
} from "@aee/core";

/**
 * Stub grounding observer. Phase 1 wires real capture (DOM diff, a11y tree,
 * element screenshot, image bytes, computed styles, announcements). Until then
 * it yields no evidence, which downstream produces UNKNOWN — never a guessed PASS.
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

export const domObserver = stubObserver("dom");
export const a11yTreeObserver = stubObserver("a11y-tree");
export const screenshotObserver = stubObserver("screenshot");
export const imageObserver = stubObserver("image");
export const stylesObserver = stubObserver("styles");
export const networkObserver = stubObserver("network");
/** Deterministic, CI-safe (default). A real-SR observer is opt-in/gated later. */
export const virtualScreenReaderObserver = stubObserver("virtual-screen-reader");

/** Default grounding observers fed to the runner. */
export const groundingObservers: Observer[] = [
  domObserver,
  a11yTreeObserver,
  screenshotObserver,
  imageObserver,
  stylesObserver,
  networkObserver,
  virtualScreenReaderObserver,
];
