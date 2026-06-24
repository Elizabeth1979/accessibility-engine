import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ArtifactRef } from "@aee/core";

export interface StoredArtifact {
  bytes: Uint8Array;
  mime?: string;
}

/**
 * Content-addressed artifact store: heavy bytes (screenshots, image data) live here once,
 * keyed by their sha256, while EvidenceRecords carry only a light ArtifactRef. Identical
 * content dedupes to a single entry.
 *
 * In-memory by default. Given a `dir`, blobs are also written to (and read back from) disk
 * under that directory, so a content-addressed screenshot survives across processes — the
 * persistence path the agent surfaces use when AEE_STORE_DIR is set.
 *
 * The store lives in @aee/playwright (the capture layer) and is reachable by @aee/engine,
 * but NOT by @aee/ai — which depends on @aee/core alone. So the AI can never resolve a ref
 * itself: the engine inlines the bytes into the evidence it hands the model, preserving the
 * "AI sees evidence only" invariant while keeping heavy bytes out of the persisted evidence.
 */
export class ArtifactStore {
  readonly #blobs = new Map<string, StoredArtifact>();
  readonly #dir?: string;

  constructor(dir?: string) {
    this.#dir = dir;
  }

  // Content-addressed id -> a filesystem-safe path (the colon in "sha256:" can't go in a filename).
  #pathFor(id: string): string | undefined {
    return this.#dir ? join(this.#dir, id.replace(":", "-")) : undefined;
  }

  /** Store bytes (or a base64 string) and return a content-addressed ref. Dedupes by content. */
  put(data: Uint8Array | string, mime?: string): ArtifactRef {
    const bytes = typeof data === "string" ? new Uint8Array(Buffer.from(data, "base64")) : data;
    const id = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (!this.#blobs.has(id)) this.#blobs.set(id, { bytes, mime });
    const path = this.#pathFor(id);
    if (path && !existsSync(path)) {
      mkdirSync(this.#dir as string, { recursive: true });
      writeFileSync(path, bytes);
    }
    return { id, mime, bytes: bytes.byteLength };
  }

  get(id: string): StoredArtifact | undefined {
    const inMemory = this.#blobs.get(id);
    if (inMemory) return inMemory;
    const path = this.#pathFor(id);
    if (path && existsSync(path)) {
      const loaded: StoredArtifact = { bytes: new Uint8Array(readFileSync(path)) };
      this.#blobs.set(id, loaded); // cache the disk read
      return loaded;
    }
    return undefined;
  }

  has(id: string): boolean {
    if (this.#blobs.has(id)) return true;
    const path = this.#pathFor(id);
    return path ? existsSync(path) : false;
  }

  /** Base64 of the stored bytes, for inlining into evidence at judge time. */
  base64(id: string): string | undefined {
    const blob = this.get(id);
    return blob ? Buffer.from(blob.bytes).toString("base64") : undefined;
  }

  /** Number of distinct blobs held in memory (identical content counts once). */
  get size(): number {
    return this.#blobs.size;
  }
}

/**
 * Process-wide default store shared by capture (put) and the engine (resolve). Disk-backed at
 * AEE_STORE_DIR/artifacts when that env var is set (so screenshots resolve across processes),
 * otherwise in-memory.
 */
export const defaultArtifactStore = new ArtifactStore(
  process.env.AEE_STORE_DIR ? join(process.env.AEE_STORE_DIR, "artifacts") : undefined,
);
