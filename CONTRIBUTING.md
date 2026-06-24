# Contributing to AEE

Thanks for your interest! AEE is implemented end to end — Tiers 1–5, the agent surfaces (`@aee/mcp`, `@aee/triage`), and remediation (`@aee/fix`), runnable local-first with no API key. The most useful contributions are the forward-looking items in [`docs/ROADMAP.md`](docs/ROADMAP.md) under **Future** (framework-aware `apply_fix` source mapping; network / audio / OS-screen-reader capture; a fuller triage UI).

## Ground rules (architecture invariants)

These are enforced by the package dependency graph and CI — please preserve them:

1. **`@aee/core` depends only on `zod`.** It holds contracts and schemas, nothing else.
2. **The AI layer sees evidence only.** `@aee/ai` depends only on `@aee/core` and must never import a driver or touch the live page. AI judgments are grounded in captured `EvidenceRecord`s so they are reproducible. `@aee/engine` is the only package allowed to reach both a driver (`@aee/playwright`) and the judges.
3. **UNKNOWN never becomes PASS.** Advisory (Tier 5) judgments may not produce a confident PASS.
4. **axe-core is the deterministic floor**, not a thing to re-implement. Spend AI on contextual quality (Tiers 1–3), not on what static rules already do well (Tier 4).

`tests/graph-guard.test.js` checks the dependency edges and pnpm's strict `node_modules` enforces them at import time — keep both green.

## Workflow

```bash
pnpm install
pnpm build        # tsc -b across all packages
pnpm test         # node --test over built dist/
pnpm gen:schemas  # regenerate JSON Schema in /schemas from the zod source
pnpm demo         # investigate a sample page and print the graded report
```

- TypeScript, ESM, strict mode. Source uses explicit `.js` import extensions (NodeNext).
- Tests run with the built-in Node test runner over compiled `dist/`. Browser and local-model tests are gated, so the suite stays green without Chromium or a model; set `AEE_LLM_PROVIDER=local` (with a local server) to exercise real judging.
- Each package is a TypeScript project reference; add new cross-package deps in both `package.json` and the package `tsconfig.json` `references`.
- `zod` is the single source of truth for contracts; run `pnpm gen:schemas` if you change a persisted schema.
- Docs are clean reflowable markdown, committed in-repo.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for current state and what's next, [`docs/PLAN.md`](docs/PLAN.md) for the architecture, and [`docs/`](docs/) for the design docs and ADRs.
