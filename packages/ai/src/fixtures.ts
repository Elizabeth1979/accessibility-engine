import { type EvidenceRecord, type Intent, SCHEMA_VERSION } from "@aee/core";

/**
 * Hand-authored evidence for the naming / text-alternatives wedge — no browser.
 * `after` carries what a grounding observer would capture; `imageDescription`
 * stands in for what the vision-capable capture will provide later.
 */
export interface NamingPayload {
  kind: "image" | "icon-button" | "link" | "heading";
  accessibleName: string | null;
  context: string;
  imageDescription?: string;
}

export interface NamingFixture {
  label: string;
  intent?: Intent;
  evidence: EvidenceRecord[];
  /** Expected verdict family for the live test (PASS, or a non-PASS: FAIL/WARN). */
  expect: "PASS" | "non-PASS";
}

function evidence(payload: NamingPayload): EvidenceRecord[] {
  return [
    {
      schemaVersion: SCHEMA_VERSION,
      interactionId: "fixture-1",
      at: 0,
      observer: "naming",
      before: null,
      after: payload,
      changes: [],
      confidence: "high",
      source: "observed",
    },
  ];
}

export const NAMING_FIXTURES: NamingFixture[] = [
  {
    label: "meaningless alt text ('image')",
    expect: "non-PASS",
    evidence: evidence({
      kind: "image",
      accessibleName: "image",
      context: "Product card on a clothing storefront listing a winter coat for sale.",
      imageDescription: "A red wool knee-length winter coat shown on a model.",
    }),
  },
  {
    label: "good, contextual alt text",
    expect: "PASS",
    evidence: evidence({
      kind: "image",
      accessibleName: "Red wool knee-length winter coat, shown on a model",
      context: "Product card on a clothing storefront listing a winter coat for sale.",
      imageDescription: "A red wool knee-length winter coat shown on a model.",
    }),
  },
  {
    label: "icon button named 'button'",
    expect: "non-PASS",
    intent: {
      purpose: "Clothing storefront",
      notes: "the cart icon in the header opens the cart drawer",
    },
    evidence: evidence({
      kind: "icon-button",
      accessibleName: "button",
      context: "Top-right of the storefront header, next to the search field.",
      imageDescription: "A shopping-cart glyph.",
    }),
  },
  {
    label: "missing alt on an informative image",
    expect: "non-PASS",
    evidence: evidence({
      kind: "image",
      accessibleName: null,
      context: "Hero banner at the top of the storefront home page.",
      imageDescription: "Promotional text reading 'Summer Sale — 50% off' over a beach photo.",
    }),
  },
];
