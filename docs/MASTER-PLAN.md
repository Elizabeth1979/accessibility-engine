# Master plan: one accessibility toolkit

This is the working plan for turning a dozen accessibility repos into one tool developers use on every pull request. It is the single source of truth for that work. Any new chat starts here, finds the first unchecked step, and does that step.

## How to use this file

- **Start a session:** open a Claude Code session on `accessibility-engine` and say *"continue the master plan"*. `CLAUDE.md` points here, so a fresh chat picks up the context without this conversation.
- **One step per session.** Each step is sized for one sitting and has a "done when" line.
- **Tick the box in the same PR that does the work.** The file is then always true, and git history is the log.
- **Decisions go in the Decisions log below**, not in chat. Chat is lost; this file is not.

## Goal

A developer opens a PR. CI runs their existing Playwright tests with the engine attached, then:

1. **axe fails the build** on real violations (deterministic, trusted).
2. **AI suggests the fix** for each violation, using a screenshot of the section and the page context. This is advisory and never fails the build.
3. **Each finding links to the pattern** that explains it (a11y-skills).

The first rules covered are unlabeled buttons, unlabeled links, missing alt text, missing form labels and empty headings.

## Target shape

```
KNOWLEDGE   a11y-skills          patterns (markdown) + data: axe-rule→pattern map, WCAG and APG metadata
               │ npm dependency, pinned
ENGINE      accessibility-engine capture → axe floor (blocking) + AI judges (advisory) → report → fix
               │
SURFACES    Playwright fixture · GitHub Action + PR comment · MCP server · HTML report (QA/design)

SEPARATE PRODUCTS (keep, consume the knowledge later)
            screen-reader-cli (real/virtual screen readers) · clip-to-ticket (recordings → tickets)
```

## Inventory: every source and where its value goes

Nothing is archived until its row says **harvested**. That is how no information gets lost.

### Core (keep, active)

| Repo | Role | What moves / status |
|---|---|---|
| `accessibility-engine` | **The engine** | — |
| `a11y-skills` | **The knowledge** | Receives data files (M1) |
| `screen-reader-cli` | Separate product: screen readers | Later: `scan` calls the engine (M7) |
| `a11y-engineering-toolkit` | Portfolio page only | Portfolio map updated at the end (M8) |

### Merge into the core, then archive

| Repo | Value to harvest | Goes to | Harvested |
|---|---|---|---|
| `a11y-agent` | axe-rule → pattern map (stale filenames), `A11Y_STRICT` threshold, auto-scan on navigation | a11y-skills `axe-rules.json` (M1); Action `fail-on` (M4); fixture auto-checkpoint (M4) | [ ] |
| `accessibility-evidence-engine` | Interaction video, virtual-SR transcript, scenario CLI, report design, example pages | Example pages → corpus (M3); the rest → QA surface (M7) | [ ] |
| `a11y-expert-mcp` | Tool ideas only; its patterns are a stale copy of a11y-skills | MCP `explain` tool (M6) | [ ] |
| `accessibility-validator` | Nothing new; axe covers it | — | [ ] |
| `sr-visualizer` | "Good" and "bad" sample pages; SR-announcement UI | Samples → corpus (M3); UI → QA surface (M7) | [ ] |
| `wcag-alt-generator` | Image-role classification (decorative / functional / informative) | Alt-text judge prompt (M2) | [ ] |
| `alt-generation-claude` | Alt-text best-practice rules and prompt; image + context input | Alt-text judge prompt (M2) and the image-labeling pattern (M1) | [ ] |
| `a11y-for-feds-intro` | A deliberately broken page with 16 listed issues and their fixes | **Golden test corpus** with known answers (M3); stays live as a workshop | [ ] (keep repo) |
| `bookmarklets` | Visual overlays: headings, tab order, alt text, focus indicator | QA/designer surface overlays (M7); stays live | [ ] (keep repo) |
| `clip-to-ticket` | `wcag22-full.json` (W3C WCAG data), `apg-patterns.json`, ticket format, axe rule service | WCAG/APG data → a11y-skills `data/` (M1); ticket format → reporter (M7). Stays live as its own product | [ ] (keep repo) |

### Private notes (read, scrub, then move)

| Source | Value | Goes to | Harvested |
|---|---|---|---|
| `e11i-brain` → `Work old/2 - Resources/A11y` and `Accessible components` | Short notes on links, contrast, non-text contrast, mouse-only, RTL, mobile, cards, multi- vs single-select, drag and drop, autocomplete | Pattern improvements in a11y-skills (M1, step 1.5) | [ ] |
| `e11i-brain` → `Clippings` | ACT Rules Format, WCAG-EM, ARIA-AT, WCAG 3 | Design references for the judges (M2, step 2.4) | [ ] |

**Scrub rule:** anything that moves from a private note into a public repo is rewritten generically. No employer, product or partner names, and no internal links or screenshots. If a note only makes sense with that context, it doesn't move.

### Out of scope (no action)

`visua11y` (reading aid for end users, not a developer tool), `any-access` (three small 2020 scripts, all covered by a11y-skills), `accessible-search`, `a11y-first-ext`, `a11y-booth-game`, and the forks `a11y-memory-game`, `a11y-interactions`, `a11y-html-aria`. Also checked and unrelated to accessibility: `TTS`, `the-vault`, and the rest of the personal and family repos.

## Milestones

Each "day" is one focused session. Skipping days is fine; skipping order is not.

### M0 — Home base (day 1)

- [ ] **0.1** Review and merge the PR that adds this file. *Done when:* this file is on `main` and `CLAUDE.md` points here.
- [ ] **0.2** Answer the three open questions (below) and record the answers in the Decisions log. *Done when:* no open questions block M1–M4.

### M1 — One knowledge source (days 2–5)

- [ ] **1.1** a11y-skills: add `patterns/axe-rules.json` (axe rule id → pattern file), seeded from a11y-agent's map with the filenames fixed. The validator checks every target exists. *Done when:* `npm run validate` passes and fails if a mapped file is removed.
- [ ] **1.2** a11y-skills: add `data/wcag.json` and `data/apg.json`. Take WCAG from the W3C source with a pinned version and attribution, rather than copying clip-to-ticket's file. *Done when:* both files are there, and the validator checks every WCAG criterion a pattern cites against `data/wcag.json`.
- [ ] **1.3** a11y-skills: merge alt-text rules from `alt-generation-claude` and `wcag-alt-generator` into `image-labeling.instructions.md`, keeping only what isn't already there. *Done when:* image-role decision (decorative / functional / informative) is in the pattern with good and bad examples.
- [ ] **1.4** a11y-skills: make the package publishable (drop `private`, set `files`) and publish 1.1.0. *Done when:* `npm view a11y-skills version` shows it.
- [ ] **1.5** Scrub and move the private component notes into a11y-skills. This is several small PRs, one topic each; skip any note that is only a link. *Done when:* each note row in the inventory is ticked or marked "nothing to move".

### M2 — Engine uses the knowledge (days 6–8)

- [ ] **2.1** engine: new `@aee/skills` package (it depends on `@aee/core` only) with `patternFor(ruleId)` and `criterion(id)`, reading the pinned `a11y-skills`. It keeps no copy of the data. *Done when:* the unit tests pass and `tests/graph-guard.test.js` covers the new edge.
- [ ] **2.2** engine: axe verdicts carry `pattern` and WCAG criterion names. Schemas regenerated. *Done when:* a `button-name` verdict links to the buttons pattern and names SC 4.1.2.
- [ ] **2.3** engine: strengthen the alt-text judge prompt with image-role classification. *Done when:* the corpus (M3) decorative-image case passes.
- [ ] **2.4** engine: write a short ADR on shaping judges like ACT rules (applicability, expectation, outcome). *Done when:* `docs/adr/0006-*.md` exists. It records the decision only; no code changes.

### M3 — Golden test corpus (days 9–10)

- [ ] **3.1** Port the broken page from `a11y-for-feds-intro`, plus the bad and good samples from sr-visualizer and evidence-engine, into `examples/corpus/`, each with an `expected.json` listing the findings it must produce. *Done when:* the pages are in the repo, and each has an `expected.json`.
- [ ] **3.2** A corpus test runs the engine (stub AI) on every page and compares the result to the expected findings. *Done when:* `pnpm test` fails if a known violation is missed or a good page gets a finding.

### M4 — The PR experience (days 11–15)

- [ ] **4.1** reporter: `renderReportMarkdown()` puts blocking findings first, then advisory ones. Each finding is collapsed and shows the element, the problem, the AI-suggested fix and the pattern link. *Done when:* a snapshot test on a corpus page passes.
- [ ] **4.2** fixture: auto-checkpoint on page load (if decided in 0.2). *Done when:* a test with no explicit checkpoint still produces findings.
- [ ] **4.3** A composite `action.yml` with inputs `test-command`, `fail-on` and `ai-provider` (default `stub`). It posts one sticky comment that later runs update. *Done when:* running it twice leaves exactly one comment.
- [ ] **4.4** A self-test workflow: every PR in this repo runs the Action against the corpus. *Done when:* a PR that adds a nameless icon button gets red CI and a comment with the buttons pattern link.
- [ ] **4.5** AI on in CI: `ai-provider: claude` with an `ANTHROPIC_API_KEY` secret. *Done when:* the comment shows an AI-suggested name for the button, labelled as AI.

### M5 — Ship and dogfood (days 16–18)

- [ ] **5.1** Publish the engine packages under the chosen npm scope, with a publish workflow gated on the full suite. *Done when:* `npm install -D <scope>/engine` works in an empty project.
- [ ] **5.2** Adopt it in one of your own public apps. The setup should be one dependency, one import swap and one workflow step. *Done when:* that repo's PRs get the comment.
- [ ] **5.3** Write down every friction point from 5.2 as issues and fix the top one. *Done when:* the adoption steps in the README fit on one screen.

### M6 — One MCP (days 19–20)

- [ ] **6.1** `@aee/mcp`: add an `explain` tool (rule id or UI element in, the a11y-skills pattern out). *Done when:* a coding agent asked "explain button-name" gets the buttons pattern.
- [ ] **6.2** a11y-expert-mcp: final PyPI release whose README points to `aee-mcp`. *Done when:* the PyPI page shows the notice.

### M7 — QA and designer surface (later, after M5 is used for real)

- [ ] **7.1** Design spec only: an HTML report view combining evidence-engine's report design, the bookmarklets overlays, sr-visualizer's announcement list and clip-to-ticket's ticket format. *Done when:* a spec is in `docs/specs/`.
- [ ] **7.2** screen-reader-cli: have `scan` call the engine. This is an issue first, per that repo's rules. *Done when:* the issue is filed with the proposed change.

### M8 — Archive and re-map (last)

- [ ] **8.1** For each repo marked "archive" whose inventory row is ticked: add a README banner saying it's superseded by accessibility-engine, then use GitHub's Archive button. *Done when:* every archive row is ticked and archived.
- [ ] **8.2** Update the portfolio map in `a11y-engineering-toolkit`. *Done when:* the public page shows the new shape.

## Open questions

1. **npm scope:** is `@aee` free? If not, what name?
2. **Auto checkpoints:** scan automatically on every page load (zero effort for adopters, noisier), or only at explicit `aee.checkpoint()` calls? Recommendation: automatic on load, plus explicit checkpoints for states after interactions.
3. **Default `fail-on`:** `serious` (recommended, matches axe's severity), or only the five MVP rules for a gentler rollout.

## Decisions log

Newest first. One line each: date, decision, why.

- 2026-09-24 — `accessibility-engine` is the engine; `a11y-skills` is the only knowledge source. Why: the engine already has the fixture, the axe floor, the naming judges and fixes, while a11y-skills is the most complete and validated knowledge base.
- 2026-09-24 — AI output never fails CI; only axe does. Why: a false positive that blocks a merge gets the tool turned off.
- 2026-09-24 — The CI default AI provider is `stub`; AI turns on with an API key. Why: running a local model on CI runners is slow and heavy.
