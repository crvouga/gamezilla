// @io-wall-ok — runs `quint verify` (Quint, which starts an Apalache server) and cleans up after it.
/**
 * Model-check a Quint model: `quint verify` with Apalache, the bounded model
 * checker, over every behavior of the model up to `maxSteps` steps — every
 * action, every value it can draw, every interleaving — requiring each
 * invariant in every state it reaches. Where `simulate` samples a few runs,
 * this is exhaustive up to the bound: an invariant a run could break within
 * it is refuted with a counterexample.
 *
 * Apalache is the one pinned in `mise.toml`, never a download (see
 * `./apalache`). Each check starts its own Apalache server on a free port, in
 * its own process group, with `outDir` as its working directory (so
 * `_apalache-out/` lands there); the whole group is killed when Quint exits,
 * when the deadline passes and when this process exits or is interrupted, so
 * no server outlives its check.
 *
 * The verdict is a function of the model, the invariants and the bound:
 * Apalache's search is symbolic (SMT), not seeded.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wallStopwatch } from '@pkgs/quint-shared/wall';
import {
  APALACHE_VERSION,
  freePort,
  linkQuintHome,
  resolveApalache,
  verifyEnv,
} from './apalache';
import { cachedVerifyInput } from './cached-verify-input';
import { runQuint } from './run-quint';
import { QUINT_CLI, quintModuleName } from './simulate';
import { runVerifyPhaseGroup } from './verify-phase-pool';
import type { VerifyPhase } from './verify-phases';
import { verifyPhases } from './verify-phases';

export type VerifyOptions = {
  /** Absolute path of the `.qnt` model. */
  readonly specPath: string;
  /** The `val`s to require in every reachable state (`invFriendsBothWays`, …). */
  readonly invariants: readonly string[];
  /** Steps after `init` the checker explores, at most. */
  readonly maxSteps: number;
  /** Prove this candidate initially, under every step, and as implying every invariant. */
  readonly inductiveInvariant?: string;
  /** Opt into fresh solver phases, without rechecking the assumed initial candidate. */
  readonly separateInduction?: boolean;
  /** Apalache's working directory and QUINT_HOME (emptied first). */
  readonly outDir: string;
  /** Kill the check (Quint and its Apalache server) after this long. */
  readonly timeoutMs: number;
  /** Opt into array-encoded maps for models supported by that encoding. */
  readonly encoding?: 'fun-arrays';
};

export type VerifyResult =
  | { readonly ok: true; readonly durationMs: number }
  | { readonly ok: false; readonly output: string };

const DOWNLOADING = 'Downloading Apalache';

export async function verify(options: VerifyOptions): Promise<VerifyResult> {
  if (options.invariants.length === 0) {
    return {
      ok: false,
      output: `quint verify ${options.specPath}: declares no invariant (\`val inv<Name> = …\`) — a model checked against nothing proves nothing; state what must hold in every state`,
    };
  }
  const apalache = resolveApalache(process.env);
  if ('error' in apalache) return { ok: false, output: apalache.error };
  rmSync(options.outDir, { recursive: true, force: true });
  mkdirSync(options.outDir, { recursive: true });
  const phases = verifyPhases({
    ...options,
    source: readFileSync(options.specPath, 'utf8'),
    module: quintModuleName(options.specPath),
  });
  const env = verifyEnv({
    env: process.env,
    quintHome: linkQuintHome(options.outDir, apalache.home),
  });
  const elapsed = wallStopwatch();
  const prepared = {
    ...options,
    specPath: cachedVerifyInput(options.specPath, options.outDir),
  };
  const runPhase = async (
    phase: VerifyPhase
  ): Promise<VerifyResult | undefined> => {
    const phaseOptions =
      phase.case === undefined
        ? prepared
        : {
            ...prepared,
            outDir: join(options.outDir, `case-${String(phase.case)}`),
          };
    mkdirSync(phaseOptions.outDir, { recursive: true });
    const configPath = verifyConfig(phaseOptions, phase);
    const port = await freePort();
    const run = await runQuint({
      args: verifyArgs(phaseOptions, phase, port, configPath),
      cwd: phaseOptions.outDir,
      env,
      timeoutMs: Math.max(0, options.timeoutMs - elapsed()),
    });
    return runFailure(options, phase, run);
  };
  for (const name of [
    'bounded',
    'induction',
    'initial',
    'preservation',
    'implication',
  ] as const) {
    const failure = await runVerifyPhaseGroup(
      phases.filter((phase) => phase.name === name),
      runPhase,
      process.env['MODEL_CHECK_CONCURRENCY']
    );
    if (failure !== undefined) return failure;
  }
  return { ok: true, durationMs: elapsed() };
}

function runFailure(
  options: VerifyOptions,
  phase: VerifyPhase,
  run: Awaited<ReturnType<typeof runQuint>>
): VerifyResult | undefined {
  const strategy =
    options.inductiveInvariant === undefined
      ? `max steps ${String(options.maxSteps)}`
      : `induction: ${options.inductiveInvariant}`;
  const header = `quint verify ${options.specPath} (invariants: ${options.invariants.join(', ')}; ${strategy}; ${phase.name})`;
  if (run.output.includes(DOWNLOADING)) {
    return {
      ok: false,
      output: `${header}: Quint tried to download Apalache — the pinned one was not found\n${run.output}`,
    };
  }
  if (run.timedOut) {
    return {
      ok: false,
      output: `${header}: no verdict within ${String(options.timeoutMs)} ms — simplify the abstraction or split the model without weakening its guarantees\n${tail(run.output)}`,
    };
  }
  if (run.code !== 0) {
    return {
      ok: false,
      output: `${header} failed (exit code ${run.code ?? 'none'}, signal ${run.signal ?? 'none'}):\n${verdict(run.output)}`,
    };
  }
  return undefined;
}

function verifyArgs(
  options: VerifyOptions,
  phase: VerifyPhase,
  port: number,
  configPath: string
): string[] {
  return [
    QUINT_CLI,
    'verify',
    options.specPath,
    '--main',
    quintModuleName(options.specPath),
    '--max-steps',
    String(phase.maxSteps),
    '--apalache-config',
    configPath,
    '--apalache-version',
    APALACHE_VERSION,
    '--server-endpoint',
    `127.0.0.1:${String(port)}`,
    ...(phase.invariants.length === 0
      ? []
      : ['--invariants', ...phase.invariants]),
    ...(phase.init === undefined ? [] : ['--init', phase.init]),
    ...(phase.step === undefined ? [] : ['--step', phase.step]),
    ...(phase.inductiveInvariant === undefined
      ? []
      : ['--inductive-invariant', phase.inductiveInvariant]),
  ];
}

function verifyConfig(options: VerifyOptions, phase: VerifyPhase): string {
  const path = join(
    options.outDir,
    phase.name === 'preservation'
      ? 'apalache-config-preservation.json'
      : 'apalache-config.json'
  );
  const checker = {
    ...(options.encoding === undefined
      ? {}
      : { 'smt-encoding': { type: options.encoding } }),
    tuning: {
      'search.invariant.mode':
        options.inductiveInvariant === undefined ||
        phase.name === 'preservation'
          ? 'after'
          : 'before',
      // Initialization already proved the candidate. Its reflexive check
      // under that same assumption adds no obligation to preservation.
      ...(phase.name === 'preservation'
        ? { 'search.invariantFilter': '1->.*' }
        : {}),
    },
  };
  writeFileSync(path, JSON.stringify({ checker }));
  return path;
}
/**
 * Lines that say nothing about the model: the Apalache server's log
 * (`… I@09:12:03.123`), its banner and a protobuf warning of its own.
 */
const NOISE = [
  /\s[DIWE]@\d\d:\d\d:\d\d\.\d+$/,
  /^# /,
  /^Output directory: /,
  /^The Apalache server is running/,
  /com\.google\.protobuf|^WARNING: Vulnerable protobuf|^As of 2022\/09\/29/,
];

/** Quint's verdict, without the Apalache server's pass-by-pass log. */
function verdict(output: string): string {
  const at = output.indexOf('An example execution:');
  if (at >= 0) return output.slice(at).trim();
  return tail(
    output
      .split('\n')
      .filter((line) => !NOISE.some((noise) => noise.test(line)))
      .join('\n')
  );
}

function tail(output: string): string {
  return output.trim().split('\n').slice(-40).join('\n');
}
