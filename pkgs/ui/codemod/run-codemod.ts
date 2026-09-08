/**
 * Pure multi-file orchestration: map of path → content in, outputs + report
 * out. Keeps all branching testable without touching the filesystem; the
 * thin `cli-io.ts` entry supplies file IO and the git guard.
 *
 * All-or-nothing commit: `verifyStable` re-runs the transform over every
 * changed output and proves it is a fixpoint (idempotent, zero further
 * conversions). The CLI writes nothing unless every output is stable and
 * every file parsed — a failed run leaves the tree byte-identical.
 */

import { type FileReport, summarize, toFileReport } from './report';
import { invariant } from './tiger';
import { transformFile } from './transform';

export type RunOptions = {
  readonly dryRun: boolean;
};

export type RunOutput = {
  readonly path: string;
  readonly nextText: string;
  readonly changed: boolean;
};

export type RunResult = {
  readonly outputs: readonly RunOutput[];
  readonly files: readonly FileReport[];
  readonly summary: ReturnType<typeof summarize>;
  /** Changed outputs whose re-transform is not a fixpoint. Empty = committable. */
  readonly unstable: readonly string[];
};

/** Run the codemod over in-memory files. Deterministic, no IO. */
export function runCodemod(
  files: Readonly<Record<string, string>>,
  options: RunOptions
): RunResult {
  const outputs: RunOutput[] = [];
  const reports: FileReport[] = [];
  const paths = Object.keys(files);
  for (const path of paths) {
    const text = files[path] ?? '';
    const result = transformFile(path, text);
    reports.push(toFileReport(path, result));
    outputs.push({ path, nextText: result.text, changed: result.changed });
  }
  invariant(
    outputs.length === paths.length && reports.length === paths.length,
    'run lost a file'
  );
  const summary = summarize(reports, options.dryRun);
  invariant(
    summary.totalConvertedA + summary.totalConvertedB ===
      reports.reduce((n, f) => n + f.convertedA + f.convertedB, 0),
    'report counts do not add up'
  );
  return { outputs, files: reports, summary, unstable: verifyStable(outputs) };
}

/**
 * Prove every changed output is a fixpoint: re-transforming it changes
 * nothing and converts nothing further. Non-empty means "do not commit".
 */
export function verifyStable(outputs: readonly RunOutput[]): string[] {
  const bad: string[] = [];
  for (const output of outputs) {
    if (!output.changed) continue;
    const again = transformFile(output.path, output.nextText);
    if (again.text !== output.nextText || again.converted.length > 0) {
      bad.push(output.path);
    }
  }
  return bad;
}
