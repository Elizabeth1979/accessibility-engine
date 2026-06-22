# ADR 0001 — TypeScript + pnpm workspaces

**Status:** Accepted

## Context

AEE is a published, extensible framework with a plugin API and JSON schemas. Consumers and third-party plugin authors benefit from types as part of the product. The sibling project `screen-reader-cli` is plain ESM JavaScript, but it is an application, not a framework.

## Decision

Author AEE in **TypeScript (ESM, strict)**, organized as a **pnpm workspace** monorepo with TypeScript project references (`tsc -b`). Ship compiled JS + `.d.ts`. Tests run with the built-in Node test runner (`node --test`) over built `dist/`, matching the house style while avoiding TS type-stripping caveats (no enums/namespaces in source).

## Consequences

- Strong DX for plugin authors; schemas can derive from zod types.
- A build step is required; `dist/` is the test and run target.
- Cross-package wiring lives in both `package.json` (`workspace:*`) and each `tsconfig.json` `references`.
