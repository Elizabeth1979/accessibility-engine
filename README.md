# Accessibility Evidence Engine (AEE)

**AI-first accessibility testing that augments your existing Playwright tests.**

> axe tells you the `alt` attribute exists. **AEE tells you whether the alt text is _right_ — and writes you a better one.**

Static scanners (axe-core) answer *"is the attribute present?"* and top out around 30–50% of real issues, because the defects that matter — a meaningless `alt`, an icon button named "button", a heading that doesn't describe its section, meaning carried by color alone — are not statically detectable. AEE puts an **AI judgment layer** on top of that deterministic floor and asks *"is it correct in this context?"*, returning a verdict, a grounded reason, a **suggested fix**, and a reliability tier.

AEE is **agent-native**: you operate it by chat through an MCP server (run investigations, query the evidence, apply fixes), declare a page's **intent** in plain language to sharpen judgments, chat with the report locally, and let it open remediation PRs.

> ⚠️ **Status: pre-alpha scaffold.** This repository currently contains the architecture, contracts, JSON schemas, and typed **stubs** only — no accessibility logic yet. See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and milestones.

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

## Quickstart (target API — not yet implemented)

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

## Development

```bash
pnpm install
pnpm build       # tsc -b across all packages
pnpm typecheck
pnpm test        # node --test over built dist/
pnpm gen:schemas # regenerate JSON Schema in /schemas from the zod source
```

Requires Node ≥ 22 and pnpm.

## License

[MIT](LICENSE)
