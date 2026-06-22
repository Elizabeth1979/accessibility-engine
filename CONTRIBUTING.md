# Contributing to AEE

Thanks for your interest! AEE is in early scaffold stage.

## Ground rules (architecture invariants)

These are enforced by the package dependency graph and CI — please preserve them:

1. **`@aee/core` depends only on `zod`.** It holds contracts and schemas, nothing else.
2. **The AI layer sees evidence only.** `@aee/ai` depends only on `@aee/core` and must never import a driver or touch the live page. AI judgments are grounded in captured `EvidenceRecord`s so they are reproducible.
3. **UNKNOWN never becomes PASS.** Advisory (Tier 5) judgments may not produce a confident PASS.
4. **axe-core is the deterministic floor**, not a thing to re-implement. Spend AI on contextual quality (Tiers 1–3), not on what static rules already do well (Tier 4).

## Workflow

```bash
pnpm install
pnpm build
pnpm test
```

- TypeScript, ESM, strict mode. Source uses explicit `.js` import extensions (NodeNext).
- Tests run with the built-in Node test runner over compiled `dist/`.
- Each package is a TypeScript project reference; add new cross-package deps in both `package.json` and the package `tsconfig.json` `references`.

See [`docs/PLAN.md`](docs/PLAN.md) for the architecture and milestones, and [`docs/`](docs/) for design docs and ADRs.
