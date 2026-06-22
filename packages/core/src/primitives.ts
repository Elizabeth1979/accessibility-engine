/** Opaque identifier for a single interaction within a run. */
export type InteractionId = string;

/** Monotonic timestamp (milliseconds) from the run Clock. */
export type ClockTime = number;

/** Monotonic clock used to order and correlate evidence across observers. */
export interface Clock {
  now(): ClockTime;
}
