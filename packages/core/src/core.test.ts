import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHEMA_VERSION, zEvidenceRecord, zStatus, zVerdict } from "./schemas.js";

test("EvidenceRecord schema validates a well-formed record", () => {
  const parsed = zEvidenceRecord.parse({
    schemaVersion: SCHEMA_VERSION,
    interactionId: "i1",
    at: 0,
    observer: "dom",
    before: null,
    after: null,
    changes: [],
    confidence: "high",
    source: "observed",
  });
  assert.equal(parsed.observer, "dom");
  assert.equal(parsed.source, "observed");
});

test("verdict status includes UNKNOWN and rejects invalid values", () => {
  assert.ok(zStatus.options.includes("UNKNOWN"));
  assert.throws(() =>
    zVerdict.parse({
      status: "MAYBE",
      confidence: "low",
      reliability: "advisory",
      reason: "x",
      evidenceRefs: [],
    }),
  );
});
