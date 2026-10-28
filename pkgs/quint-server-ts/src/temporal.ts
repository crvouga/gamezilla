// @io-wall-ok — runs TLC from the pinned checker distribution and writes its config.
/** Temporal properties require a complete finite state graph, including cycles. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { quintNames } from '@pkgs/quint-shared-ts/names';
import { tlcStateSpace } from '@pkgs/quint-shared-ts/tlc-state-space';
import { verifyDeadlineMs, wallStopwatch } from '@pkgs/quint-shared-ts/wall';
import { privateQuintHome, resolveApalache, verifyEnv } from './apalache';
import { instantiatedModelInput } from './model-input';
import { modelParameterCases, modelParameterId } from './model-parameters';
import { quintModuleName } from './model-source';
import { runTemporalChecker } from './temporal-checker';

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
  removeTree(options.outDir);
  mkdirSync(options.outDir, { recursive: true });
  const elapsed = wallStopwatch();
  const deadlineMs = verifyDeadlineMs(options.timeoutMs);
  const cases = modelParameterCases(
    readFileSync(options.specPath, 'utf8'),
    quintModuleName(options.specPath)
  );
  let statesExplored = 0;
  let searchDepth = 0;
  for (const parameters of cases) {
    const id = modelParameterId(parameters);
    const outDir = id === '' ? options.outDir : join(options.outDir, id);
    mkdirSync(outDir, { recursive: true });
    const specPath =
      id === ''
        ? options.specPath
        : instantiatedModelInput(options.specPath, outDir, parameters);
    const result = await checkTemporalCase({
      options: { ...options, specPath, outDir },
      apalacheHome: pinned.home,
      deadlineMs: Math.max(0, deadlineMs - elapsed()),
    });
    if (!result.ok) return result;
    statesExplored += result.statesExplored;
    searchDepth = Math.max(searchDepth, result.searchDepth);
  }
  return { ok: true, durationMs: elapsed(), statesExplored, searchDepth };
}

async function checkTemporalCase(input: {
  readonly options: TemporalOptions;
  readonly apalacheHome: string;
  readonly deadlineMs: number;
}): Promise<TemporalResult> {
  const { options, apalacheHome, deadlineMs } = input;
  const elapsed = wallStopwatch();
  const header = `quint TLC ${options.specPath} (properties: ${options.properties.join(', ')}; safety: ${(options.invariants ?? []).join(', ')})`;
  const run = await runTemporalChecker({
    options,
    apalacheHome,
    env: verifyEnv({
      // The compiler and TLC JVM share the throughput collector; TLC's
      // heap and worker count are pinned by the owned checker launcher.
      env: {
        ...process.env,
        JVM_GC_ARGS: '-XX:+UseParallelGC -Xmx2048m -Xms2048m',
        JAVA_TOOL_OPTIONS: `${process.env['JAVA_TOOL_OPTIONS'] ?? ''} -XX:+UseParallelGC`,
      },
      quintHome: privateQuintHome(options.outDir),
    }),
    deadlineMs,
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
