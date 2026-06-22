import { SCHEMA_VERSION } from "@aee/core";
import type { ReleasePolicy, ReleaseStatus, Report, Verdict } from "@aee/core";

const countBy = (verdicts: Verdict[], status: Verdict["status"]): number =>
  verdicts.filter((v) => v.status === status).length;

/** Strict: any FAIL blocks, any UNKNOWN holds. UNKNOWN is never treated as PASS. */
export const strictReleasePolicy: ReleasePolicy = {
  name: "strict",
  decide(verdicts: Verdict[]): ReleaseStatus {
    const fails = countBy(verdicts, "FAIL");
    const unknowns = countBy(verdicts, "UNKNOWN");
    const decision = fails > 0 ? "block" : unknowns > 0 ? "hold" : "ship";
    return { decision, fails, unknowns, reason: `strict: ${fails} fail, ${unknowns} unknown` };
  },
};

/** Lenient: FAIL blocks, UNKNOWN warns but does not hold. Still never a PASS. */
export const lenientReleasePolicy: ReleasePolicy = {
  name: "lenient",
  decide(verdicts: Verdict[]): ReleaseStatus {
    const fails = countBy(verdicts, "FAIL");
    const unknowns = countBy(verdicts, "UNKNOWN");
    const decision = fails > 0 ? "block" : "ship";
    return { decision, fails, unknowns, reason: `lenient: ${fails} fail, ${unknowns} unknown` };
  },
};

export function buildReport(
  findings: Verdict[],
  policy: ReleasePolicy = strictReleasePolicy,
): Report {
  return {
    schemaVersion: SCHEMA_VERSION,
    summary: {
      total: findings.length,
      pass: countBy(findings, "PASS"),
      fail: countBy(findings, "FAIL"),
      warn: countBy(findings, "WARN"),
      unknown: countBy(findings, "UNKNOWN"),
    },
    findings,
    release: policy.decide(findings),
  };
}

export function renderTerminalSummary(report: Report): string {
  const s = report.summary;
  const lines = [
    `AEE — ${s.total} findings: ${s.pass} pass · ${s.fail} fail · ${s.warn} warn · ${s.unknown} unknown`,
    `Release: ${report.release.decision.toUpperCase()} (${report.release.reason})`,
  ];
  for (const f of report.findings) {
    const fix = f.suggestedFix ? ` → fix: ${f.suggestedFix}` : "";
    lines.push(`  [${f.status}] ${f.reason}${fix}`);
  }
  return lines.join("\n");
}
