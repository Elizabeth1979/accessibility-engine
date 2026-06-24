import {
  type Clock,
  type Driver,
  type EvidenceRecord,
  type Interaction,
  type Observer,
  type ObserverContext,
  type ScreenReaderPayload,
  SCHEMA_VERSION,
} from "@aee/core";
import { virtual } from "@guidepup/virtual-screen-reader";
import { JSDOM } from "jsdom";

/**
 * Drive a virtual screen reader once through the given HTML and return the ordered phrases
 * it speaks — the literal "what a screen-reader user hears" transcript. Runs entirely in
 * Node against a jsdom DOM (no browser), so it is CI-safe: a screen reader reads the
 * accessibility tree (roles + accessible names), which is DOM/ARIA derived rather than
 * pixel derived, so jsdom fidelity is sufficient.
 *
 * `virtual` is a module-global cursor, so transcripts must not run concurrently — AEE's
 * capture is sequential. The traversal stops at the screen reader's "end of document"
 * marker (it otherwise wraps and repeats), with a hard cap as a safety net.
 */
export async function screenReaderTranscript(html: string): Promise<string[]> {
  const dom = new JSDOM(html);
  try {
    await virtual.start({
      container: dom.window.document.body,
      window: dom.window,
    } as unknown as Parameters<typeof virtual.start>[0]);
    const CAP = 1000;
    for (let i = 0; i < CAP; i += 1) {
      await virtual.next();
      if ((await virtual.lastSpokenPhrase()) === "end of document") break;
    }
    return await virtual.spokenPhraseLog();
  } finally {
    await virtual.stop().catch(() => {});
    dom.window.close();
  }
}

/**
 * Opt-in screen-reader grounding observer. Snapshots the live page's DOM via the Driver,
 * then drives a virtual screen reader over it, emitting the spoken transcript as one
 * EvidenceRecord (kind "screen-reader"). Deliberately NOT in the default grounding set: a
 * full SR traversal on every capture is too heavy, so callers opt in explicitly.
 *
 * With no driver, or on any failure, it yields no evidence — observer isolation, never a
 * crash, never a guessed PASS. `dispose` clears the captured driver.
 */
export function createScreenReaderObserver(): Observer {
  let driver: Driver | undefined;
  let clock: Clock | undefined;
  return {
    name: "screen-reader",
    async init(ctx: ObserverContext): Promise<void> {
      driver = ctx.driver;
      clock = ctx.clock;
    },
    async beforeInteraction(_i: Interaction): Promise<void> {},
    async collect(i: Interaction): Promise<EvidenceRecord[]> {
      if (!driver || !clock) return [];
      let transcript: string[];
      try {
        const html = String(await driver.snapshotDom());
        transcript = await screenReaderTranscript(html);
      } catch {
        return []; // observer isolation: no evidence on failure, never a crash
      }
      return [
        {
          schemaVersion: SCHEMA_VERSION,
          interactionId: i.id,
          at: clock.now(),
          observer: "screen-reader",
          before: null,
          after: {
            kind: "screen-reader",
            transcript,
            itemCount: transcript.length,
          } satisfies ScreenReaderPayload,
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
