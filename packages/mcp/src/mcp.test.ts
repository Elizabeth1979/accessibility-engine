import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, investigate, listTools } from "./index.js";

test("MCP exposes the AEE tool surface", () => {
  const tools = listTools();
  assert.equal(tools.length, 6);
  assert.ok(tools.some((t) => t.name === "investigate"));
  assert.ok(tools.some((t) => t.name === "apply_fix"));
});

test("investigate returns an empty, valid report for a non-HTML target", async () => {
  const report = await investigate("http://example.test");
  assert.equal(report.summary.total, 0);
  assert.equal(report.release.decision, "ship");
});

test("the MCP server registers its tools and answers over a transport", async () => {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 6);
    assert.ok(tools.some((t) => t.name === "investigate"));
    assert.ok(tools.some((t) => t.name === "explain"));

    // A round-trip that needs neither a browser nor a model: a non-HTML target → empty report.
    const result = await client.callTool({
      name: "investigate",
      arguments: { target: "http://example.test" },
    });
    assert.ok(Array.isArray(result.content));
    assert.equal(result.content[0]?.type, "text");
  } finally {
    await client.close();
  }
});
