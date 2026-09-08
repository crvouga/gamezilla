/**
 * Codemod report types + plain-text formatting.
 *
 * Pure: formatting is a string function over report data. The CLI prints the
 * result; tests assert on the data and the formatted text.
 */

import type { FileResult } from './transform';

export type FileReport = {
  readonly path: string;
  readonly changed: boolean;
  readonly convertedA: number;
  readonly convertedB: number;
  readonly manual: readonly {
    line: number;
    component: string;
    reason: string;
  }[];
  readonly parseError?: string | undefined;
};

export type CodemodReport = {
  readonly files: readonly FileReport[];
  readonly totalConvertedA: number;
  readonly totalConvertedB: number;
  readonly totalManual: number;
  readonly parseFailures: number;
  readonly dryRun: boolean;
};

export function toFileReport(path: string, result: FileResult): FileReport {
  return {
    path,
    changed: result.changed,
    convertedA: result.converted.filter((c) => c.tier === 'A').length,
    convertedB: result.converted.filter((c) => c.tier === 'B').length,
    manual: result.manual.map((m) => ({
      line: m.line,
      component: m.component,
      reason: m.reason,
    })),
    parseError: result.parseError,
  };
}

export function summarize(
  files: readonly FileReport[],
  dryRun: boolean
): CodemodReport {
  return {
    files,
    totalConvertedA: files.reduce((n, f) => n + f.convertedA, 0),
    totalConvertedB: files.reduce((n, f) => n + f.convertedB, 0),
    totalManual: files.reduce((n, f) => n + f.manual.length, 0),
    parseFailures: files.filter((f) => f.parseError !== undefined).length,
    dryRun,
  };
}

function fileLines(report: FileReport): string[] {
  const lines = [
    `${report.changed ? 'CHANGED' : 'ok'} ${report.path} ` +
      `(A:${report.convertedA} B:${report.convertedB} manual:${report.manual.length})`,
  ];
  if (report.parseError !== undefined) {
    lines.push(`  parse failure: ${report.parseError}`);
  }
  for (const node of report.manual) {
    lines.push(`  manual L${node.line} <${node.component}>: ${node.reason}`);
  }
  return lines;
}

/** One report line per file plus a totals footer. No colors, no padding. */
export function formatReport(report: CodemodReport): string {
  const lines: string[] = [];
  for (const file of report.files) lines.push(...fileLines(file));
  lines.push(
    `totals: files=${report.files.length} ` +
      `convertedA=${report.totalConvertedA} convertedB=${report.totalConvertedB} ` +
      `manual=${report.totalManual} parseFailures=${report.parseFailures} ` +
      `mode=${report.dryRun ? 'dry-run' : 'write'}`
  );
  return lines.join('\n');
}
