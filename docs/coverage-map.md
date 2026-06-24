# Coverage map — where AI takes testing toward 100%

AEE tiers every accessibility concern by **what AI actually changes** relative to a static scanner. The tier drives whether a judge leans on the deterministic floor, the AI layer, or both — and how much to trust the result.

> **Implemented today:** Tier 1 in full; Tier 2 color-alone, focus-visible, and text-in-images on a vision model; Tier 3 focus-management, live-region, and keyboard-operable; Tier 4 via the axe-core floor; Tier 5 caption-accuracy as advisory-only (it can never certify `PASS`, and judging accuracy against audio is future work). See [`ROADMAP.md`](ROADMAP.md).

## Tier 1 — AI transforms binary checks into quality + fix (the wedge)

Static tools check *presence*; AI checks *correctness in context* and drafts a fix.

- **Alt text** — meaningful for this image in this context, not "image of…"; decorative handled correctly.
- **Icon-only button names** — infer function from the icon + surrounding UI; suggest *"Open clothes drawer"*, not *"button"*.
- **Link / button text** — flag "click here" / "read more"; propose contextual text.
- **Form labels** — clarity; catch placeholder-as-label.
- **Headings** — does the heading describe what follows; visual-vs-semantic mismatch.

*AI is authoritative here; floor = axe presence check.*

## Tier 2 — AI sees what static rules are blind to

- Meaning conveyed by **color alone** (required = red only).
- **Text baked into images** (OCR + judge).
- **Contrast over images / gradients** where the effective background can't be resolved statically.
- **Focus indicator** actually visible and sufficient.
- **Visual vs. DOM reading order** mismatch.

*AI unlocks these; little or no static floor exists.*

## Tier 3 — AI + runtime evidence (dynamic; static scanners are blind)

- Focus moved **sensibly** on modal / route change.
- Dynamic change **announced and meaningful** (live regions).
- Custom widget **genuinely keyboard-operable** end to end.
- Error messages announced, associated, **and actionable**.

*Requires the evidence engine (observers + settle/correlation) plus AI judgment.*

## Tier 4 — Keep deterministic; AI adds nothing

- Exact contrast ratios, target-size pixels, ARIA validity, duplicate IDs.

*Wrap axe-core as the floor. Do not spend AI here — math and spec are cheaper and more reliable.*

## Tier 5 — AI assists but must not certify (advisory only)

- Caption accuracy vs. audio, plain-language adequacy for specific cognitive disabilities, "will a real AT user succeed."

*Emits `WARN`/`UNKNOWN` + a suggestion, **never** a confident `PASS`. This is where the rule "UNKNOWN ≠ PASS" does real work, and where human review remains essential.*
