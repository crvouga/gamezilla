// @io-wall-ok — runs TLC from the pinned checker distribution and writes its config.
/** Temporal properties require a complete finite state graph, including cycles. */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { quintNames } from '@pkgs/quint-shared/names';
import { tlcStateSpace } from '@pkgs/quint-shared/tlc-state-space';
import { verifyDeadlineMs, wallStopwatch } from '@pkgs/quint-shared/wall';
import {
  APALACHE_VERSION,
  freePort,
  linkQuintHome,
  resolveApalache,
  verifyEnv,
} from './apalache';
import { runQuint } from './run-quint';
import { QUINT_CLI, quintModuleName } from './simulate';

export type TemporalOptions = {
  readonly specPath: string;
  readonly properties: readonly string[];
  /** Check safety throughout the same complete graph as progress. */
  readonly invariants?: readonly string[];
  readonly outDir: string;
  readonly timeoutMs: number;
};

export type TemporalResult =
  | {
      readonly ok: true;
      readonly durationMs: number;
      readonly statesExplored: number;
      readonly searchDepth: number;
    }
  | { readonly ok: false; readonly output: string };

/** Private temporal definitions are assumptions, rather than obligations. */
export function modelTemporalProperties(source: string): readonly string[] {
  return quintNames(source)
    .declarations.filter(
      (declared) =>
        declared.kind === 'temporal' && !declared.name.startsWith('_')
    )
    .map((declared) => declared.name);
}

export async function verifyTemporal(
  options: TemporalOptions
): Promise<TemporalResult> {
  const safety = (options.invariants ?? []).join(', ');
  const header = `quint TLC ${options.specPath} (properties: ${options.properties.join(', ')}; safety: ${safety})`;
  if (options.properties.length === 0) {
    return {
      ok: false,
      output: `${header}: no temporal property — nothing checks progress`,
    };
  }
  const pinned = resolveApalache(process.env);
  if ('error' in pinned) return { ok: false, output: pinned.error };
  rmSync(options.outDir, { recursive: true, force: true });
  mkdirSync(options.outDir, { recursive: true });
  const config = join(options.outDir, 'tlc-config.json');
  writeFileSync(
    config,
    JSON.stringify({ maxHeap: '-Xmx512m', stackSize: '-Xss8m', workers: 1 })
  );
  const elapsed = wallStopwatch();
  const deadlineMs = verifyDeadlineMs(options.timeoutMs);
  const port = await freePort();
  const run = await runQuint({
    args: temporalArgs(options, config, port),
    cwd: options.outDir,
    env: verifyEnv({
      env: process.env,
      quintHome: linkQuintHome(options.outDir, pinned.home),
    }),
    timeoutMs: deadlineMs,
  });
  writeFileSync(join(options.outDir, 'tlc-output.txt'), run.output);
  if (run.timedOut)
    return {
      ok: false,
      output: `${header}: no complete verdict within ${deadlineMs} ms\n${run.output}`,
    };
  if (run.code !== 0)
    return { ok: false, output: `${header} failed:\n${run.output}` };
  const graph = tlcStateSpace(run.output);
  if (graph === null) {
    return {
      ok: false,
      output: `${header}: TLC produced no state-space evidence\n${run.output}`,
    };
  }
  return {
    ok: true,
    durationMs: elapsed(),
    statesExplored: graph.states,
    searchDepth: graph.depth,
  };
}

function temporalArgs(
  options: TemporalOptions,
  config: string,
  port: number
): string[] {
  return [
    QUINT_CLI,
    'verify',
    options.specPath,
    '--main',
    quintModuleName(options.specPath),
    '--backend',
    'tlc',
    '--apalache-version',
    APALACHE_VERSION,
    '--server-endpoint',
    `127.0.0.1:${String(port)}`,
    '--temporal',
    options.properties.join(','),
    '--tlc-config',
    config,
    '--verbosity',
    '3',
    ...((options.invariants?.length ?? 0) === 0
      ? []
      : ['--invariants', ...(options.invariants ?? [])]),
  ];
}
