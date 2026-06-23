# Accessibility Evidence Engine (AEE)

**AI-first accessibility testing that augments your existing Playwright tests.**

> axe tells you the `alt` attribute exists. **AEE tells you whether the alt text is _right_ — and writes you a better one.**

Static scanners (axe-core) answer *"is the attribute present?"* and top out around 30–50% of real issues, because the defects that matter — a meaningless `alt`, an icon button named "button", a heading that doesn't describe its section, meaning carried by color alone — are not statically detectable. AEE puts an **AI judgment layer** on top of that deterministic floor and asks *"is it correct in this context?"*, returning a verdict, a grounded reason, a **suggested fix**, and a reliability tier.

AEE is **agent-native**: you operate it by chat through an MCP server (run investigations, query the evidence, apply fixes), declare a page's **intent** in plain language to sharpen judgments, chat with the report locally, and let it open remediation PRs.

> ⚠️ **Status: pre-alpha.** The **Tier-1 naming / alt-text wedge works end to end** — a live Playwright page is captured to evidence and judged (with a suggested fix) by Claude **or a local model, no API key**. Broader coverage and the agent surfaces (MCP, triage, fix) are still typed **stubs**. See [`docs/PLAN.md`](docs/PLAN.md) for the plan and milestones.

## How it works

```
Playwright test → observers capture EVIDENCE → AI judges quality (evidence only) → REPORT + fixes
                                                         ↑
                              AI-first surfaces: MCP server · triage UI · auto-fix/PR
```

The core invariant: **AI sees captured evidence only, never the live page** — so judgments are grounded and reproducible, and the rule *UNKNOWN never becomes PASS* holds.

## Packages

| Package | Role |
| --- | --- |
| `@aee/core` | Contracts, zod schemas, evidence/judge/report types (depends on `zod` only) |
| `@aee/observers` | Evidence grounding: DOM, a11y tree, screenshots, images, styles, network, SR |
| `@aee/ai` | AI judgment + conversational `explain()` + fix drafting (evidence only) |
| `@aee/judges` | Per-concern judges = axe-core floor + AI judgment |
| `@aee/playwright` | Driver + test fixture + `checkpoint()` |
| `@aee/reporter` | JSON report + terminal summary |
| `@aee/mcp` | MCP server — the agent-native surface |
| `@aee/triage` | Local "chat with your report" UI |
| `@aee/fix` | Apply suggested fixes and open PRs |

## Quickstart — drop-in Playwright fixture

```ts
import { test, expect } from '@aee/playwright'; // drop-in for '@playwright/test'

test('checkout flow', async ({ page, aee }) => {
  await page.goto('/checkout');
  await aee.checkpoint('checkout-loaded', {
    intent: { purpose: 'Checkout', primaryAction: 'Pay', notes: 'cart icon opens the cart drawer' },
  });
  // ...your existing test, unchanged...
});
```

## Talk to it — the MCP server

AEE is agent-native: a coding agent (Claude Code, Cursor, …) connects to the MCP server and investigates pages by chat. Build, then run it over stdio:

```bash
pnpm build
node packages/mcp/dist/bin.js      # or `aee-mcp` once the package is linked
```

Register it like any stdio MCP server — local model, no API key:

```json
{ "mcpServers": { "aee": {
  "command": "node",
  "args": ["/abs/path/accessibility-engine/packages/mcp/dist/bin.js"],
  "env": { "AEE_LLM_PROVIDER": "local" }
} } }
```

Then *investigate* a page (→ a graded report with fixes), *explain* a finding from evidence, and *suggest_fix* (→ targeted `FixPlan`s the agent applies to source). Full reference: [docs/mcp-tools.md](docs/mcp-tools.md).

## Development

```bash
pnpm install
pnpm build       # tsc -b across all packages
pnpm typecheck
pnpm test        # node --test over built dist/
pnpm gen:schemas # regenerate JSON Schema in /schemas from the zod source
```

Requires Node ≥ 22 and pnpm.

## Model backends (no API key required)

The AI layer is provider-agnostic: it depends on a one-method `JudgmentModel` seam, not on any SDK. Pick a backend with `createAIClient({ provider })` or the `AEE_LLM_PROVIDER` env var.

| Provider | Backend | Needs |
| --- | --- | --- |
| `local` | A local model over the OpenAI-compatible API (Ollama, LM Studio, llama.cpp, vLLM, …) | a running local server — **no key** |
| `claude` | Anthropic Claude (`claude-opus-4-8` by default) | `ANTHROPIC_API_KEY` |
| `stub` | Always-`UNKNOWN` (the default when no key is set) | nothing |

Run the engine against a local model — no key, no cloud:

```bash
# Ollama (default base URL http://localhost:11434/v1)
export AEE_LLM_PROVIDER=local
export AEE_LLM_MODEL=gemma4:e4b      # any chat model you have pulled
pnpm test                            # the local live tests now exercise real judging
```

Point `AEE_LLM_BASE_URL` at LM Studio (`http://localhost:1234/v1`), llama.cpp, vLLM, or any OpenAI-compatible endpoint. A local judgment that can't be reached or parsed degrades to `UNKNOWN` — never a guessed `PASS`.

## License

[MIT](LICENSE)
