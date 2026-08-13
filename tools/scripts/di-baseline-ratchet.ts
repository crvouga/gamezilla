// @io-wall-ok — tools composition root
/**
 * Shared baseline ratchet helpers for transaction-scoped DI CI gates.
 *
 * When `baselinePath` is missing, the inventory is expected to be empty
 * (fail closed on any violation).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';

export type DiViolation = {
  readonly key: string;
  readonly path: string;
  readonly line: number;
  readonly message: string;
};

export function runBaselineRatchet(args: {
  readonly ciName: string;
  readonly repoRoot: string;
  readonly baselinePath: string;
  readonly violations: DiViolation[];
  readonly docsHint: string;
}): void {
  const { ciName, repoRoot, baselinePath, violations, docsHint } = args;
  const sorted = [...violations].sort((a, b) => a.key.localeCompare(b.key));

  const writeBaseline = process.env['WRITE_BASELINE'] === '1';
  if (writeBaseline) {
    const keys = sorted.map((v) => v.key);
    writeFileSync(baselinePath, `${JSON.stringify(keys, null, 2)}\n`, 'utf8');
    console.log(
      `Wrote baseline (${String(keys.length)} entries) → ${relative(repoRoot, baselinePath)}`
    );
    for (const v of sorted) {
      console.log(`  ${v.path}:${String(v.line)}: ${v.message}`);
    }
    process.exit(0);
  }

  let baseline: string[] = [];
  if (existsSync(baselinePath)) {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as string[];
  }

  const baselineSet = new Set(baseline);
  const currentKeys = new Set(sorted.map((v) => v.key));
  const newViolations = sorted.filter((v) => !baselineSet.has(v.key));
  const staleBaseline = baseline.filter((k) => !currentKeys.has(k));

  if (newViolations.length > 0 || staleBaseline.length > 0) {
    console.error(`${ciName} FAILED:`);
    if (newViolations.length > 0) {
      console.error('\nNew violations (not in baseline):');
      for (const v of newViolations) {
        console.error(`  - ${v.path}:${String(v.line)}: ${v.message}`);
      }
    }
    if (staleBaseline.length > 0) {
      console.error(
        '\nStale baseline entries (no longer violate) — remove from baseline:'
      );
      for (const k of staleBaseline) {
        console.error(`  - ${k}`);
      }
    }
    console.error(
      `\n${docsHint} Update baseline only via WRITE_BASELINE=1 after intentional inventory changes.`
    );
    process.exit(1);
  }

  console.log(
    `${ciName} OK (${String(sorted.length)} violations, ${String(baseline.length)} baseline entries)`
  );
}
