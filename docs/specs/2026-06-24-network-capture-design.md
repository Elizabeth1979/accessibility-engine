# Network (CDP) capture — design

Future item ① from [`docs/ROADMAP.md`](../ROADMAP.md). Approved 2026-06-24.

## Goal — the accessibility bug it catches

An interaction fires a network request that **fails** (a 4xx/5xx response or an outright network error), but the failure is never communicated to assistive technology — no live-region announcement, no focus moved to an error, no associated error message. A sighted user sees a red toast; a screen-reader user is left believing the action succeeded. This is dynamic and semantic, so axe cannot see it. It is the canonical Tier-3 concern: errors must be announced, associated, **and actionable**.

## Approach

Capture network activity with **Playwright's high-level network events** (`page.on('response')` and `page.on('requestfailed')`), recording each request's method, URL, status, and failed flag. This fits the existing `@aee/playwright` capture layer (which already drives the page through Playwright), works without raw CDP, and captures exactly what the check needs.

Alternatives considered and rejected: raw CDP `Network.*` via the Driver's `cdp` seam (more detail — headers and bodies — than the check needs, and Chromium-only); response-body inspection (overkill — we don't need bodies to know a request failed).

## Components

- **`zNetworkPayload`** in `@aee/core`: `{ kind: "network", trigger, requests: Array<{ method, url, status, failed }>, domChanged, announcement? }`. Added to the evidence-payload union so boundary validation recognises it.
- **`captureNetwork(html, { trigger, name?, intent? })`** in `@aee/playwright`: attach the response/requestfailed listeners, focus and activate the trigger, let the page settle, then record the requests that fired plus `domChanged` and any `announcement` (reusing the existing `readAnnouncement` browser helper). Emits one `network` evidence record. Mirrors the shape of `captureInteraction` / `captureLiveRegion`.
- **`networkErrorJudge`** in `@aee/judges` (Tier 3, concern `network-error`): the floor-plus-AI pattern. The deterministic signal is "a request failed" (status ≥ 400 or `failed`). The AI judges, from the evidence, whether the failure was surfaced accessibly (announced via a live region, or focus/DOM moved to a meaningful, actionable error). Authoritative, like the other Tier-3 dynamic judges.
- **Engine route** `network → { concern: "network-error", judge: networkErrorJudge }`, plus a `network-error` entry in the prompt guidance.

## Data flow and invariants

`captureNetwork` → a `network` evidence record → the engine routes it by kind → `networkErrorJudge` → `ai.judge`. The AI sees only the captured evidence (the recorded requests + the announcement), never the live page — `@aee/ai` still depends on `@aee/core` alone. UNKNOWN and advisory results never become PASS. All capture stays inside `@aee/playwright`.

## Judge logic

- No failed request → PASS (nothing to announce).
- A failed request **and** no announcement and no error surfaced in focus/DOM → FAIL: the failure is silent for assistive-tech users.
- A failed request that was announced / surfaced → the AI judges whether the message is meaningful and actionable (PASS, or WARN if present but weak).
- Insufficient evidence → UNKNOWN.

## Testing

- **Hermetic / deterministic (browser-gated, no real server):** a page whose button `fetch`es an endpoint that `page.route` fulfils with **500**, announcing nothing → assert the `network` evidence records the failed request. No network egress; the failure is simulated in-page.
- **End-to-end (browser + local model gated):** the silent-failure page → `networkErrorJudge` returns non-PASS; a variant that announces the error in an `aria-live` region → PASS.

## Scope

In scope: capture of request outcomes for one activated trigger, and the silent-failure judgment. Out of scope for this increment (revisit if wanted): slow/pending-request judgments (spinner that never resolves), request/response bodies, and multi-step flows. One capture function, one payload, one judge, one route, prompt guidance, and the tests above — a single self-contained increment with a real consumer.
