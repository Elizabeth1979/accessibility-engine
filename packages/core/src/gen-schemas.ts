/**
 * Generates JSON Schema files in /schemas from the zod source of truth.
 * Run via `pnpm gen:schemas` (which builds first, then runs the compiled file).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { zAIJudgment, zEvidenceRecord, zFixPlan, zReport, zVerdict } from "./schemas.js";

const here = dirname(fileURLToPath(import.meta.url)); // packages/core/dist
const outDir = resolve(here, "../../../schemas");

const artifacts = [
  ["evidence-record", zEvidenceRecord, "EvidenceRecord"],
  ["ai-judgment", zAIJudgment, "AIJudgment"],
  ["verdict", zVerdict, "Verdict"],
  ["fix-plan", zFixPlan, "FixPlan"],
  ["report", zReport, "Report"],
] as const;

mkdirSync(outDir, { recursive: true });

for (const [name, schema, title] of artifacts) {
  const json = zodToJsonSchema(schema, title);
  writeFileSync(join(outDir, `${name}.schema.json`), `${JSON.stringify(json, null, 2)}\n`);
  console.log(`wrote schemas/${name}.schema.json`);
}
