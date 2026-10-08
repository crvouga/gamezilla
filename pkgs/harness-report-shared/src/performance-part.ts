import type { RunReport } from '@pkgs/harness-root-shared/report-types';
import type { ReportPart } from './explorer-types';
import { performanceRows } from './performance';

/** Diagnostic budgets over recorded self time; no missing measurement becomes a pass. */
export function performancePart(args: {
  readonly sha: string;
  readonly recordedAtMs: number;
  readonly allowanceMs: number;
  readonly reports: readonly RunReport[];
}): ReportPart {
  if (!Number.isFinite(args.allowanceMs) || args.allowanceMs <= 0)
    throw new Error('Invalid performance allowance');
  return {
    sha: args.sha,
    id: 'recorded-performance',
    kind: 'performance',
    title: 'Recorded action performance',
    recordedAtMs: args.recordedAtMs,
    checks: args.reports.map((report) => {
      const rows = performanceRows(report.steps, args.allowanceMs);
      const measured = rows.filter((row) => row.band !== 'unmeasured');
      const slow = rows.filter((row) => row.band === 'slow').length;
      const maximum = measured.reduce(
        (max, row) => Math.max(max, row.step.performance!.selfMs),
        0
      );
      return {
        id: report.meta.testId,
        title: report.meta.title,
        status:
          slow > 0
            ? 'failed'
            : rows.length === 0 || rows.length !== measured.length
              ? 'not-run'
              : 'passed',
        detail: `${measured.length} measured steps; ${slow} over the diagnostic allowance. Includes waits and harness work.`,
        ...(report.meta.sourceFile === undefined
          ? {}
          : { specPath: report.meta.sourceFile }),
        measurements:
          measured.length === 0
            ? []
            : [
                {
                  name: 'Longest own action',
                  value: maximum,
                  unit: 'ms',
                  limit: args.allowanceMs,
                },
              ],
      };
    }),
  };
}
