# Plugin API

AEE is extensible through two plugin points: **observers** (collect evidence) and **judges** (evaluate it). Both are typed in `@aee/core`.

## Writing a Judge

A judge evaluates one accessibility concern. It composes an optional **deterministic floor** with an **AI judgment**, and is tagged with a coverage [tier](coverage-map.md).

```ts
import type { Judge, Verdict, EvidenceRecord, AIClient, JudgeContext } from '@aee/core';

export const altTextJudge: Judge = {
  name: 'alt-text',
  tier: 1,
  // Optional deterministic floor (often axe-core backed): is an alt attribute present at all?
  floor(evidence: EvidenceRecord[]): Verdict { /* ... */ },
  // AI judgment, grounded in evidence only, may use declared intent:
  async judge(evidence: EvidenceRecord[], ai: AIClient, ctx: JudgeContext): Promise<Verdict> {
    const j = await ai.judge('alt-text', evidence, ctx.intent);
    return { ...j, evidenceRefs: j.evidenceRefs };
  },
};
```

Rules:

- A judge **never reads the live page** — only `EvidenceRecord[]`.
- It must never upgrade `UNKNOWN` (or an advisory AI judgment) to `PASS`.
- Tier 4 judges should lean on the floor and skip the AI call; Tier 5 judges must mark results `reliability: "advisory"`.

## Writing an Observer

```ts
import type { Observer, EvidenceRecord, Interaction, EvidenceWindow, ObserverContext } from '@aee/core';

export const domObserver: Observer = {
  name: 'dom',
  async init(ctx: ObserverContext) { /* attach to ctx.driver */ },
  async beforeInteraction(i: Interaction) { /* snapshot baseline */ },
  async collect(i: Interaction, w: EvidenceWindow): Promise<EvidenceRecord[]> { /* diff → records */ },
  async dispose() { /* cleanup */ },
};
```

Observers may fail safely: throwing or returning `[]` yields no evidence (→ `UNKNOWN` downstream), never a crash.

## Registration

Observers and judges are plain objects registered with the runner (in `@aee/playwright`). Third-party packages can publish their own and register them, which is why the contracts live in the dependency-light `@aee/core`.
