# Framework-aware apply_fix — design

Future item ② from [`docs/ROADMAP.md`](../ROADMAP.md). Implemented 2026-06-24.

## Goal

`apply_fix` patches attribute fixes (alt / aria-label / title) into source. The original
implementation was a regex over HTML source. This extends it to **JSX/TSX**, the form real React
source takes, by parsing rather than pattern-matching — so it can locate the element robustly and,
crucially, refuse anything it can't patch without corrupting the file.

## Approach

Parse the source with `@babel/parser` (the `jsx` + `typescript` plugins), find the JSX opening
element that matches the fix target, and apply a **text splice** using the matched node's character
range. Parsing only to *locate* (then splicing text) preserves the file's formatting exactly and
avoids a code printer. The regex HTML path is kept for HTML source.

Rejected alternatives: a regex over JSX (would duplicate an expression-valued attribute —
`aria-label={x}` becomes `aria-label={x} aria-label="…"` — corrupting the file); a full
codemod/printer such as recast (heavier, and reformats untouched code).

## Components

- **`applyFixToJsx(plan, source)`** in `@aee/fix`: parse → collect JSX opening elements → match the
  target by the plan's `#id`, or, with no id, by the attribute's current `before` value → splice.
- **`applyFixToSource(plan, source)`**: a dispatcher — if the source parses as JS/TS/JSX and contains
  JSX, use the AST patcher; otherwise fall back to the HTML regex `applyFix`.
- `applyFixes` (and therefore the MCP `apply_fix` tool) now route through `applyFixToSource`, so the
  agent flow is framework-aware transparently.

## Safety rules (never corrupt source)

- A string-literal attribute value → replace it.
- A **dynamic JSX expression** value (`aria-label={…}`) → **decline** with a manual instruction.
- A missing attribute → insert it after the element's tag name.
- Zero or more-than-one match → decline (not found / ambiguous).
- A non-string-settable attribute (text/label content) → decline, as before.

## Testing

A committed set of JSX cases: patch a string attribute on a component located by id (surrounding JSX
untouched); decline a dynamic-expression attribute leaving the source byte-for-byte unchanged; insert
a missing attribute; match by current value when there's no id; decline ambiguity; and the dispatcher
routing JSX→AST and HTML→regex. All hermetic — no browser, no model.

## Scope

In scope: string-attribute fixes on JSX elements identified by a stable id or their current attribute
value. Deferred (genuinely larger, documented in the ROADMAP): patching *inside* expressions, rewiring
a component's props/interface, multi-file resolution, and mapping a purely structural DOM selector (no
stable attribute) back to its source — which needs a build-time source map, not just a parse.
