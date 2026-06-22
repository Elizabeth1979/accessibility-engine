import type { ReleaseStatus, Verdict } from "./schemas.js";

/**
 * Decides release status from a set of verdicts. By contract it never converts
 * UNKNOWN or advisory results into a "ship" decision.
 */
export interface ReleasePolicy {
  readonly name: string;
  decide(verdicts: Verdict[]): ReleaseStatus;
}
