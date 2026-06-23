# Accessibility Evidence Engine — agent guide

AI-first accessibility testing: AI elevates each check from "is the attribute present?" to "is it correct in context, and here's a better value." Tier 1 (the naming wedge) is complete. See `docs/ROADMAP.md` for what's next and `docs/PLAN.md` for the architecture.

## Frozen invariants (do not break)

- **AI sees captured evidence only, never the live page.** `@aee/ai` depends on `@aee/core` only. `tests/graph-guard.test.js` enforces this and the other graph edges — keep it green. The only package allowed to depend on both a driver (`@aee/playwright`) and the judges is `@aee/engine`.
- **Verdicts never silently upgrade:** UNKNOWN and advisory results must never become PASS.

## Defaults

- **Local-first, no API key.** The AI layer is provider-agnostic (the `JudgmentModel` seam). For local runs set `AEE_LLM_PROVIDER=local` (Ollama `gemma4:e4b` by default; see README). `claude` and `stub` providers also exist; with no key the default is `stub`, and a local judgment degrades to UNKNOWN if the server is down — never a guessed PASS.
- **Tests:** `pnpm test` runs `node --test` over built `dist/`. Each change leaves a green build. Browser and local-model tests are gated (they skip when a browser / local server is unavailable).

## Conventions

- TypeScript ESM, NodeNext resolution, `.js` import extensions, `zod` as the single schema source of truth (types via `z.infer`).
- Plans and docs: clean reflowable markdown (no hard-wrapped "bricks", no changelog sections), committed in-repo.
- Commit only when asked. This is a local-only repo with no remote; commits land on `main`.
