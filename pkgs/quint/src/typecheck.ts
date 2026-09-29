// @io-wall-ok — runs the Quint CLI (a child process).
/**
 * `quint typecheck`: the model parses, its names resolve and its types and
 * effects check. Everything else a model run does assumes it.
 */

import { spawnSync } from 'node:child_process';

import { QUINT_CLI } from './simulate';

export type TypecheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly output: string };

export function typecheck(specPath: string): TypecheckResult {
  const result = spawnSync(
    process.execPath,
    [QUINT_CLI, 'typecheck', specPath],
    { encoding: 'utf8' }
  );
  if (result.status === 0) return { ok: true };
  const output = [
    `quint typecheck ${specPath} failed:`,
    result.error?.message ?? '',
    result.stdout.trim(),
    result.stderr.trim(),
  ]
    .filter((part) => part.length > 0)
    .join('\n');
  return { ok: false, output };
}
