import type { Clock, ClockTime, InteractionId } from "./primitives.js";
import type { ArtifactRef, EvidenceRecord, InteractionType, Intent } from "./schemas.js";

export interface Interaction {
  id: InteractionId;
  type: InteractionType;
  at: ClockTime;
  target?: string;
}

export interface EvidenceWindow {
  interactionId: InteractionId;
  opensAt: ClockTime;
  closesAt?: ClockTime;
}

export interface SettleSignals {
  domIdle: boolean;
  networkIdle: boolean;
  announcementsDrained: boolean;
}

/** Decides when "after" can be captured for an interaction. */
export interface SettleStrategy {
  open(i: Interaction): EvidenceWindow;
  isSettled(signals: SettleSignals): boolean;
}

/**
 * The only seam that touches the live page. Playwright is the sole
 * implementation today; the interface keeps "framework-agnostic" honest.
 */
export interface Driver {
  eval<T = unknown>(expression: string): Promise<T>;
  screenshot(selector?: string): Promise<ArtifactRef>;
  snapshotDom(): Promise<unknown>;
  snapshotA11yTree(): Promise<unknown>;
  extractImage(selector: string): Promise<ArtifactRef>;
  computedStyle(selector: string): Promise<Record<string, string>>;
  focusedElement(): Promise<string | null>;
}

export interface ObserverContext {
  driver: Driver;
  clock: Clock;
  intent?: Intent;
}

/**
 * Collects grounded evidence around an interaction. A failure degrades to
 * "no evidence" (judges then return UNKNOWN), never a crash and never a PASS.
 */
export interface Observer {
  readonly name: string;
  init(ctx: ObserverContext): Promise<void>;
  beforeInteraction(i: Interaction): Promise<void>;
  collect(i: Interaction, window: EvidenceWindow): Promise<EvidenceRecord[]>;
  dispose(): Promise<void>;
}
