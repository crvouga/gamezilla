// @io-wall-ok — runs `quint verify` against an Apalache server of its own and cleans up after both.
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
 * its own process tree, with `outDir` as its working directory (so
 * `_apalache-out/` lands there), and Quint connects to it; both trees are
 * killed when Quint exits, when the deadline passes and when this process
 * exits or is interrupted, so no server outlives its check (`./run-quint`).
 *
 * The verdict is a function of the model, the invariants and the bound:
 * Apalache's search is symbolic (SMT), not seeded.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { verifyDeadlineMs, wallStopwatch } from '@pkgs/quint-shared-ts/wall';
import {
  APALACHE_VERSION,
  privateQuintHome,
  resolveApalache,
  verifyEnv,
} from './apalache';
import { cachedVerifyInput } from './cached-verify-input';
import { instantiatedModelInput } from './model-input';
import { modelParameterCases, modelParameterId } from './model-parameters';
import { quintModuleName } from './model-source';
import { runQuint } from './run-quint';
import { QUINT_CLI } from './simulate';
import { runVerifyPhaseGroup } from './verify-phase-pool';
import type { PhaseSelection, VerifyPhase } from './verify-phases';
import { selectVerifyPhase, verifyPhases } from './verify-phases';

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
  /** Preserve every induction case, sharing a solver phase across this many. */
  readonly inductionCaseGroupSize?: number;
  /** Opt into independent bounded phases without changing targets or bounds. */
  readonly boundedInvariantGroupSize?: number;
  /** Apalache's working directory and QUINT_HOME (emptied first). */
  readonly outDir: string;
  /** Kill the check (Quint and its Apalache server) after this long. */
  readonly timeoutMs: number;
  /** Opt into array-encoded maps for models supported by that encoding. */
  readonly encoding?: 'fun-arrays';
  /** Solver scheduling only; both modes check every reachable successor. */
  readonly invariantMode?: 'before' | 'after';
  /** Translate Boolean conjunctions/disjunctions lazily; preserve their meaning. */
  readonly shortCircuit?: boolean;
  /** Use concrete inference for models that have no polymorphic operators. */
  readonly inferPolymorphicTypes?: boolean;
  /** Run these phases of a split proof. The count must match the model. */
  readonly phase?: PhaseSelection;
};

export type VerifyResult =
  | {
      readonly ok: true;
      readonly durationMs: number;
      /** Invariants this run proved. A phase proves its own share. */
      readonly invariants: readonly string[];
    }
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
  removeTree(options.outDir);
  mkdirSync(options.outDir, { recursive: true });
  const phases = phasesOf(options);
  if ('ok' in phases) return phases;
  const env = verifyEnv({
    env: process.env,
    quintHome: privateQuintHome(options.outDir),
  });
  const elapsed = wallStopwatch();
  const deadlineMs = verifyDeadlineMs(options.timeoutMs);
  const cases = modelParameterCases(
    readFileSync(options.specPath, 'utf8'),
    quintModuleName(options.specPath)
  );
  for (const parameters of cases) {
    const id = modelParameterId(parameters);
    const outDir = id === '' ? options.outDir : join(options.outDir, id);
    mkdirSync(outDir, { recursive: true });
    const specPath =
      id === ''
        ? options.specPath
        : instantiatedModelInput(options.specPath, outDir, parameters);
    const failure = await runSelectedPhases({
      options: { ...options, specPath, outDir },
      phases,
      apalacheHome: apalache.home,
      env,
      deadlineMs,
      elapsed,
    });
    if (failure !== undefined) return failure;
  }
  return {
    ok: true,
    durationMs: elapsed(),
    invariants: phases.flatMap((phase) => phase.invariants),
  };
}

function phasesOf(
  options: VerifyOptions
): readonly VerifyPhase[] | VerifyResult {
  const selected = selectVerifyPhase(
    verifyPhases({
      ...options,
      source: readFileSync(options.specPath, 'utf8'),
      module: quintModuleName(options.specPath),
    }),
    options.phase
  );
  if ('error' in selected) {
    return {
      ok: false,
      output: `quint verify ${options.specPath}: ${selected.error}`,
    };
  }
  return selected.phases;
}

async function runSelectedPhases(input: {
  readonly options: VerifyOptions;
  readonly phases: readonly VerifyPhase[];
  readonly apalacheHome: string;
  readonly env: Record<string, string>;
  readonly deadlineMs: number;
  readonly elapsed: () => number;
}): Promise<VerifyResult | undefined> {
  const prepared = {
    ...input.options,
    specPath: cachedVerifyInput(input.options.specPath, input.options.outDir),
  };
  const runPhase = async (
    phase: VerifyPhase
  ): Promise<VerifyResult | undefined> => {
    const phaseOptions =
      phase.case === undefined
        ? prepared
        : {
            ...prepared,
            outDir: join(input.options.outDir, `case-${String(phase.case)}`),
          };
    mkdirSync(phaseOptions.outDir, { recursive: true });
    const configPath = verifyConfig(phaseOptions, phase);
    const run = await runQuint({
      args: verifyArgs(phaseOptions, phase, configPath),
      cwd: phaseOptions.outDir,
      env: input.env,
      apalacheHome: input.apalacheHome,
      timeoutMs: Math.max(0, input.deadlineMs - input.elapsed()),
    });
    return runFailure(
      { ...input.options, timeoutMs: input.deadlineMs },
      phase,
      run
    );
  };
  for (const name of [
    'bounded',
    'induction',
    'initial',
    'preservation',
    'implication',
  ] as const) {
    const failure = await runVerifyPhaseGroup(
      input.phases.filter((phase) => phase.name === name),
      runPhase,
      process.env['MODEL_VERIFY_CONCURRENCY']
    );
    if (failure !== undefined) return failure;
  }
  return undefined;
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
  const header = `quint verify ${options.specPath} (invariants: ${phase.invariants.join(', ')}; ${strategy}; ${phase.name})`;
  if (run.output.includes(DOWNLOADING)) {
    return {
      ok: false,
      output: `${header}: Quint could not reach the pinned Apalache server and tried to download its own\n${run.output}`,
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
        options.invariantMode ??
        (options.inductiveInvariant === undefined ||
        phase.name === 'preservation'
          ? 'after'
          : 'before'),
      ...(options.shortCircuit === undefined
        ? {}
        : { 'rewriter.shortCircuit': options.shortCircuit }),
      // Initialization already proved the candidate. Its reflexive check
      // under that same assumption adds no obligation to preservation.
      ...(phase.name === 'preservation'
        ? { 'search.invariantFilter': '1->.*' }
        : {}),
    },
  };
  writeFileSync(
    path,
    JSON.stringify({
      checker,
      ...(options.inferPolymorphicTypes === undefined
        ? {}
        : { typechecker: { inferpoly: options.inferPolymorphicTypes } }),
    })
  );
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

/**
 * Quint's verdict, without the Apalache server's pass-by-pass log. The JVM
 * ends lines with `\r\n` on Windows, so lines split on either ending.
 */
export function verdict(output: string): string {
  const at = output.indexOf('An example execution:');
  if (at >= 0) return output.slice(at).trim();
  // An opaque RPC failure can follow the server's actual exception. Keep
  // that existing diagnostic instead of retaining only the client stack.
  if (/\bINTERNAL:/.test(output)) return output.trim();
  return tail(
    output
      .split(/\r?\n/)
      .filter((line) => !NOISE.some((noise) => noise.test(line)))
      .join('\n')
  );
}

function tail(output: string): string {
  return output.trim().split(/\r?\n/).slice(-40).join('\n');
}
