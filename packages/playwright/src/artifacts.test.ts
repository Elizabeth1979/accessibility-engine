import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ArtifactStore } from "./artifacts.js";

test("the artifact store is content-addressed and dedupes identical bytes", () => {
  const store = new ArtifactStore();
  const a = store.put("aGVsbG8=", "image/png"); // base64 of "hello"
  const b = store.put("aGVsbG8=", "image/png"); // identical content
  assert.equal(a.id, b.id); // same content -> same id
  assert.match(a.id, /^sha256:[0-9a-f]{64}$/);
  assert.equal(store.size, 1); // stored once, deduped
  assert.equal(a.mime, "image/png");
  assert.ok((a.bytes ?? 0) > 0);
});

test("distinct content gets distinct ids and round-trips through the store", () => {
  const store = new ArtifactStore();
  const one = store.put(new Uint8Array([1, 2, 3]));
  const two = store.put(new Uint8Array([4, 5, 6]));
  assert.notEqual(one.id, two.id);
  assert.equal(store.size, 2);
  assert.ok(store.has(one.id));
  assert.deepEqual([...(store.get(one.id)?.bytes ?? [])], [1, 2, 3]);
  assert.equal(store.base64(two.id), Buffer.from([4, 5, 6]).toString("base64"));
});

test("a missing artifact resolves to undefined (never a fabricated blob)", () => {
  const store = new ArtifactStore();
  assert.equal(store.get("sha256:deadbeef"), undefined);
  assert.equal(store.base64("sha256:deadbeef"), undefined);
  assert.equal(store.has("sha256:deadbeef"), false);
});

test("a disk-backed store persists blobs and a fresh instance reads them back", () => {
  const dir = mkdtempSync(join(tmpdir(), "aee-artifacts-"));
  const writer = new ArtifactStore(dir);
  const ref = writer.put(new Uint8Array([9, 8, 7, 6]), "image/png");
  assert.ok(existsSync(join(dir, ref.id.replace(":", "-")))); // content-addressed blob on disk

  const reader = new ArtifactStore(dir); // no shared memory
  assert.equal(reader.size, 0);
  assert.ok(reader.has(ref.id));
  assert.deepEqual([...(reader.get(ref.id)?.bytes ?? [])], [9, 8, 7, 6]);
  assert.equal(reader.base64(ref.id), Buffer.from([9, 8, 7, 6]).toString("base64"));
});

test("in-memory stores (no dir) do not share state — no persistence by default", () => {
  const a = new ArtifactStore();
  const ref = a.put(new Uint8Array([1, 2, 3]));
  const b = new ArtifactStore();
  assert.equal(b.has(ref.id), false);
  assert.equal(b.get(ref.id), undefined);
});
