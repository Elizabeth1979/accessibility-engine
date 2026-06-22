import { performance } from "node:perf_hooks";
import type { Clock } from "@aee/core";

/**
 * Monotonic run clock in milliseconds. performance.now() is monotonic (not wall
 * time), so evidence stays correctly ordered even if the system clock changes.
 */
export function createClock(): Clock {
  const origin = performance.now();
  return { now: () => performance.now() - origin };
}
