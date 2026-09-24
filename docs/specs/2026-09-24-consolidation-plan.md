# Consolidation plan: one engine, one knowledge source, one CI surface

## Decision

`accessibility-engine` is the engine. The other repos either feed it, sit on top of it, or get archived. The goal is a tool a developer meets on every pull request: a deterministic axe gate, an AI-written fix suggestion for each finding in the context of the page, and a link to the canonical pattern that explains it.

## Target shape

```
a11y-skills                 knowledge — the only home of pattern text + the axe-rule → pattern map
      │  (npm dependency, pinned)
accessibility-engine        the engine
  capture (playwright) → axe floor (blocking) + AI judges (advisory) → report → fix
      │
surfaces — thin, no logic of their own
  • Playwright fixture      @aee/engine/test  (exists)
  • GitHub Action           runs the fixture on a PR, posts one sticky comment   (new)
  • MCP server              @aee/mcp, plus an "explain rule" tool backed by a11y-skills   (extend)
  • HTML report             @aee/reporter renderReportHtml, the QA/designer view   (exists)

separate product: screen-reader-cli (real and virtual screen-reader testing)
```

## Repo fate

| Repo | Fate | Harvest before archiving |
|---|---|---|
| `accessibility-engine` | **Keep — the engine** | — |
| `a11y-skills` | **Keep — the knowledge source** | — |
| `screen-reader-cli` | **Keep — separate product** | Later, optional: have `scan` call the engine instead of its own axe pipeline. |
| `a11y-engineering-toolkit` | **Keep — portfolio page only** | Update the portfolio map to the new shape. No engine code goes here. |
| `a11y-agent` | Archive | Its axe-rule → skill map is the seed for `axe-rules.json` (its filenames are stale; remap to current `patterns/*.instructions.md`). Its `A11Y_STRICT` threshold idea becomes the Action's `fail-on` input. |
| `accessibility-evidence-engine` | Archive | Interaction video, virtual screen-reader transcripts, and the scenario CLI. None are MVP; list them in `ROADMAP.md` Future for the QA surface. |
| `a11y-expert-mcp` | Deprecate on PyPI, then archive | Nothing. Its patterns are a stale copy of `a11y-skills`; its contrast check duplicates axe `color-contrast`. The README points to `aee-mcp`. |
| `accessibility-validator` | Archive | Nothing. It has one commit and covers about 10% of WCAG, all of which axe already covers. |
| `sr-visualizer` | Archive | Nothing for the MVP. A browser view for QA and designers comes back later as a viewer over engine reports, not a second analyzer. |

Each archive is: a README banner saying "Archived, superseded by accessibility-engine" with a link, then GitHub's "Archive repository". The repo owner does this; it is not automated.

## MVP scope

Five axe rules, chosen because they are the most common failures and the ones the naming judges already improve on:

| axe rule | Pattern | AI adds |
|---|---|---|
| `button-name` | buttons | a name derived from the icon, surrounding text, and intent |
| `link-name` | link | link text that makes sense out of context |
| `image-alt` | image-labeling | alt text, or "decorative" with a reason |
| `label` | forms | a visible label and how to associate it |
| `empty-heading` | headings | heading text, or "remove the heading element" |

Out of MVP: every other rule still runs and reports (the axe floor is unchanged). They just don't get the AI suggestion treatment in the PR comment yet.

## Phases

Each phase ends with a green `pnpm test` and a commit, per the repo's existing rule.

### Phase 1: knowledge link (a11y-skills → engine)

1. **a11y-skills:** add `patterns/axe-rules.json`, mapping axe rule id to pattern filename. `scripts/validate.mjs` checks that every target file exists. The prose rows in `INDEX.md` stay for agents; the JSON is for tools. The rule → pattern mapping lives only in this file.
2. **a11y-skills:** make the package publishable (drop `"private"`, set `files` to `patterns/`) and publish.
3. **engine:** add a small `@aee/skills` package (it depends on `@aee/core` only) with `patternFor(ruleId) → { file, url, snippet } | null`. It reads the pinned `a11y-skills` dependency; it does not vendor a copy. This is the only place the engine touches the knowledge source.
4. **engine:** `axeVerdicts()` attaches `pattern` to each axe verdict. Add the schema field in `@aee/core` and regenerate `schemas/`.

Done when: an axe `button-name` verdict in a report carries a link to `patterns/buttons.instructions.md`.

### Phase 2: PR comment renderer

1. **reporter:** `renderReportMarkdown(report)` produces one comment with blocking findings first (axe), then advisory ones (AI). Each finding shows the element, what is wrong, the suggested fix labelled as AI-suggested, and the pattern link. It is collapsed per finding so a page with 40 findings stays readable.
2. **reporter:** `fail-on` policy: which axe impacts or rules turn CI red. AI verdicts never contribute. This already holds by invariant; the test asserts it.

Done when: a snapshot test renders the storefront example into the expected markdown.

### Phase 3: GitHub Action

1. A composite `action.yml` at the repo root, with inputs `test-command`, `fail-on` (default `serious`), and `ai-provider` (default `stub`).
2. It runs the consumer's Playwright tests with the fixture, merges the per-test report JSON, and posts or updates **one** sticky PR comment (found by a hidden marker, so a re-run edits instead of stacking).
3. **AI in CI:** Ollama in a GitHub runner is slow and heavy, so the CI default is `stub` (axe gate plus pattern links, no AI text). A repo that sets an `ANTHROPIC_API_KEY` secret and `ai-provider: claude` gets suggestions. With no key the comment says "AI suggestions off" instead of pretending.
4. An `examples/pr-demo/` fixture page with the five MVP failures, and a workflow in this repo that runs the Action against it on every PR, so the Action is itself tested in CI.

Done when: a PR in this repo that adds a nameless icon button gets red CI from `button-name` and one comment with the element, an AI-suggested name (when a key is set), and the buttons pattern link.

### Phase 4: publish

1. Pick an npm scope (see open questions). Drop `private`, set versions, and add a publish workflow gated on the full suite.
2. The consumer install becomes one dev dependency plus one import swap (`@playwright/test` → `<scope>/engine/test`) plus one workflow step.

### Phase 5: MCP consolidation

1. **mcp:** add an `explain` tool: rule id or UI element in, the matching a11y-skills pattern out (through `@aee/skills`, so there is no second copy).
2. **a11y-expert-mcp:** publish a final PyPI release whose README points to `aee-mcp`, then archive.

### Phase 6: archive and re-map

Archive per the repo fate table, and update the toolkit portfolio map. This is last so nothing is archived before its harvest has landed.

## Later (not planned here)

- `screen-reader-cli scan` calls the engine.
- A QA/designer browser surface over the report HTML, taking ideas from sr-visualizer and evidence-engine (video, SR transcript).
- Scoping to what a PR changed. Running inside existing e2e tests already follows coverage; diff → URL mapping is a separate problem.

## Open questions (owner decides)

1. **npm scope.** Is `@aee` available? If not, what name?
2. **Auto checkpoints.** a11y-agent scanned automatically on every navigation; the engine fixture needs an explicit `aee.checkpoint()`. Auto is zero effort for adopters but noisier. Recommendation: auto-checkpoint on `load`, with explicit checkpoints for states after interactions.
3. **Default `fail-on`.** `serious` (recommended, matches axe's own severity) or only the five MVP rules for a gentler rollout.
