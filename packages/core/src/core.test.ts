import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHEMA_VERSION, isValidEvidenceRecord, zEvidenceRecord, zStatus, zVerdict } from "./schemas.js";

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

test("isValidEvidenceRecord accepts a recognised payload and rejects malformed evidence", () => {
  const good = {
    schemaVersion: SCHEMA_VERSION,
    interactionId: "i1",
    at: 0,
    observer: "naming",
    before: null,
    after: { kind: "image", accessibleName: "Red wool coat", context: "Winter coats" },
    changes: [],
    confidence: "high",
    source: "observed",
  };
  assert.equal(isValidEvidenceRecord(good), true);
  assert.equal(isValidEvidenceRecord({ ...good, after: { kind: "mystery" } }), false); // unknown payload
  assert.equal(isValidEvidenceRecord({ after: good.after }), false); // broken envelope
  assert.equal(isValidEvidenceRecord(null), false);
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
