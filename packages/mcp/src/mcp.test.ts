import assert from "node:assert/strict";
import { test } from "node:test";
import { investigate, listTools } from "./index.js";

test("MCP exposes the AEE tool surface", () => {
  const tools = listTools();
  assert.equal(tools.length, 6);
  assert.ok(tools.some((t) => t.name === "aee.investigate"));
  assert.ok(tools.some((t) => t.name === "aee.applyFix"));
});

test("investigate returns an empty, valid report in the scaffold", async () => {
  const report = await investigate("http://example.test");
  assert.equal(report.summary.total, 0);
  assert.equal(report.release.decision, "ship");
});
