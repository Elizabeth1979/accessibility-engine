import { createHash } from "node:crypto";
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
 * The store lives in @aee/playwright (the capture layer) and is reachable by @aee/engine,
 * but NOT by @aee/ai — which depends on @aee/core alone. So the AI can never resolve a ref
 * itself: the engine inlines the bytes into the evidence it hands the model, preserving the
 * "AI sees evidence only" invariant while keeping heavy bytes out of the persisted evidence.
 */
export class ArtifactStore {
  readonly #blobs = new Map<string, StoredArtifact>();

  /** Store bytes (or a base64 string) and return a content-addressed ref. Dedupes by content. */
  put(data: Uint8Array | string, mime?: string): ArtifactRef {
    const bytes = typeof data === "string" ? new Uint8Array(Buffer.from(data, "base64")) : data;
    const id = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (!this.#blobs.has(id)) this.#blobs.set(id, { bytes, mime });
    return { id, mime, bytes: bytes.byteLength };
  }

  get(id: string): StoredArtifact | undefined {
    return this.#blobs.get(id);
  }

  has(id: string): boolean {
    return this.#blobs.has(id);
  }

  /** Base64 of the stored bytes, for inlining into evidence at judge time. */
  base64(id: string): string | undefined {
    const blob = this.#blobs.get(id);
    return blob ? Buffer.from(blob.bytes).toString("base64") : undefined;
  }

  /** Number of distinct blobs held (identical content counts once). */
  get size(): number {
    return this.#blobs.size;
  }
}

/** Process-wide default store shared by capture (put) and the engine (resolve). */
export const defaultArtifactStore = new ArtifactStore();
