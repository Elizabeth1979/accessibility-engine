import {
  type Clock,
  type Driver,
  type EvidenceRecord,
  type Interaction,
  type NamingPayload,
  type Observer,
  type ObserverContext,
  SCHEMA_VERSION,
} from "@aee/core";

/** A naming-relevant element found in-page; mapped 1:1 to a NamingPayload record. */
interface NamingCandidate {
  selector: string;
  kind: NamingPayload["kind"];
  accessibleName: string | null;
  context: string;
}

/**
 * In-page DOM scan for naming-relevant elements (images and icon-only controls).
 * Serialized via Function.prototype.toString and run through `driver.eval`, so it
 * MUST be self-contained: it closes over nothing and reads its globals from the
 * page (hence the `globalThis as any` shims — this body executes in the browser,
 * not in Node).
 *
 * It captures the naming-relevant name sources (alt / aria-label / aria-labelledby
 * / text), not the full ARIA accessible-name algorithm; the CDP accessibility tree
 * is the future upgrade for exact computed names.
 */
function scanNamingCandidates(): NamingCandidate[] {
  const doc: any = (globalThis as any).document;
  const cssEscape: (s: string) => string =
    (globalThis as any).CSS?.escape ?? ((s: string) => s);

  const norm = (s: unknown): string => String(s ?? "").replace(/\s+/g, " ").trim();
  const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);

  function cssPath(el: any): string {
    if (el.id) return `#${cssEscape(el.id)}`;
    const parts: string[] = [];
    let node: any = el;
    while (node && node.nodeType === 1 && node !== doc.body) {
      let sel: string = node.localName;
      const parent = node.parentElement;
      if (parent) {
        const sibs = Array.prototype.filter.call(
          parent.children,
          (c: any) => c.localName === node.localName,
        );
        if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(node) + 1})`;
      }
      parts.unshift(sel);
      node = node.parentElement;
    }
    return parts.length ? parts.join(" > ") : el.localName;
  }

  function nameFor(el: any): string | null {
    const aria = norm(el.getAttribute("aria-label"));
    if (aria) return aria;
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const txt = norm(
        String(labelledby)
          .split(/\s+/)
          .map((id: string) => {
            const ref = doc.getElementById(id);
            return ref ? ref.textContent : "";
          })
          .join(" "),
      );
      if (txt) return txt;
    }
    if (el.localName === "img") {
      return el.hasAttribute("alt") ? el.getAttribute("alt") : null;
    }
    const text = norm(el.textContent);
    if (text) return text;
    return norm(el.getAttribute("title")) || null;
  }

  function contextFor(el: any): string {
    const scope =
      el.closest("section, article, main, aside, nav, header, footer, [role=region]") ||
      doc.body;
    const heading = scope ? scope.querySelector("h1,h2,h3,h4,h5,h6") : null;
    const headingText = heading ? norm(heading.textContent) : "";
    const container = el.parentElement || scope;
    const snippet = clip(norm(container ? container.textContent : ""), 160);
    return [headingText, snippet].filter(Boolean).join(" — ");
  }

  const isIconOnly = (el: any): boolean => !/\p{L}/u.test(norm(el.textContent));

  const out: NamingCandidate[] = [];
  doc.querySelectorAll("img").forEach((el: any) => {
    out.push({
      selector: cssPath(el),
      kind: "image",
      accessibleName: nameFor(el),
      context: contextFor(el),
    });
  });
  doc.querySelectorAll("button, [role=button]").forEach((el: any) => {
    if (isIconOnly(el)) {
      out.push({
        selector: cssPath(el),
        kind: "icon-button",
        accessibleName: nameFor(el),
        context: contextFor(el),
      });
    }
  });
  doc.querySelectorAll("a[href]").forEach((el: any) => {
    out.push({
      selector: cssPath(el),
      kind: "link",
      accessibleName: nameFor(el),
      context: contextFor(el),
    });
  });
  doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el: any) => {
    out.push({
      selector: cssPath(el),
      kind: "heading",
      accessibleName: nameFor(el),
      context: contextFor(el),
    });
  });
  return out;
}

const SCAN_EXPRESSION = `(${scanNamingCandidates.toString()})()`;

/**
 * Real grounding observer for the naming wedge. Uses the injected Driver (the only
 * seam to the live page) to scan for images and icon-only controls and emit one
 * EvidenceRecord per element. A scan failure yields no evidence (downstream → UNKNOWN),
 * never a crash and never a guessed PASS.
 */
export function createNamingObserver(): Observer {
  let driver: Driver | undefined;
  let clock: Clock | undefined;
  return {
    name: "naming",
    async init(ctx: ObserverContext): Promise<void> {
      driver = ctx.driver;
      clock = ctx.clock;
    },
    async beforeInteraction(_i: Interaction): Promise<void> {},
    async collect(i: Interaction): Promise<EvidenceRecord[]> {
      if (!driver || !clock) return [];
      let candidates: NamingCandidate[];
      try {
        candidates = await driver.eval<NamingCandidate[]>(SCAN_EXPRESSION);
      } catch {
        return []; // observer isolation: no evidence on failure, never a crash
      }
      const at = clock.now();
      return candidates.map((c) => ({
        schemaVersion: SCHEMA_VERSION,
        interactionId: i.id,
        at,
        observer: "naming",
        before: null,
        after: {
          kind: c.kind,
          accessibleName: c.accessibleName,
          context: c.context,
          selector: c.selector,
        } satisfies NamingPayload,
        changes: [],
        confidence: "high",
        source: "observed",
      }));
    },
    async dispose(): Promise<void> {},
  };
}
