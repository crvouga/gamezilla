// @io-wall-ok — runs the Quint CLI (a child process) and reads its trace files.
/**
 * Draw traces from a Quint model: `quint run --mbt` on the TypeScript
 * backend, which ships inside the npm package — the default Rust backend
 * downloads a binary on first use, and a gate must not reach the network.
 *
 * The draw is a function of the model and the seed alone, so a cached verdict
 * stays sound: the seed is `FC_SEED` (default `424242`, the property seed)
 * unless `PBT_RANDOM=1` asks to explore, exactly like `assertProperty`.
 *
 * A model's file is kebab-case like every file (`space-hosting.qnt`); the
 * Quint module inside it is the same name in snake_case (`space_hosting`),
 * since a Quint name cannot hold a dash.
 *
 * Every top-level `val inv<Name>` in the model is an invariant Quint checks
 * while it draws: a model that breaks its own invariant fails before any
 * trace reaches the product.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

import { decodeItfTrace, type ItfTrace, renderQuint } from './itf';
import { quintSeed } from './wall';

/** The Quint CLI that ships in the npm package, run under Bun. */
export const QUINT_CLI = Bun.resolveSync(
  '@informalsystems/quint/dist/src/cli.js',
  import.meta.dir
);

/** `space-hosting.qnt` → `space_hosting`, the module Quint runs. */
export function quintModuleName(specPath: string): string {
  return basename(specPath, '.qnt').replaceAll('-', '_');
}

export type SimulateOptions = {
  /** Absolute path of the `.qnt` model. */
  readonly specPath: string;
  /** Traces to draw (duplicates are dropped, so at most this many return). */
  readonly traces: number;
  /** Steps after `init` in each trace, at most. */
  readonly maxSteps: number;
  /** Where the `.itf.json` files are written (emptied first). */
  readonly outDir: string;
  /** Default: {@link quintSeed}. */
  readonly seed?: string;
};

export type SimulateResult = {
  readonly seed: string;
  readonly invariants: readonly string[];
  readonly traces: readonly ItfTrace[];
};

const INVARIANT = /^\s*val\s+(inv[A-Z]\w*)\b/gm;

/** The model's `val inv<Name>` definitions, in source order. */
export function modelInvariants(source: string): readonly string[] {
  return [...source.matchAll(INVARIANT)].map((match) => match[1] ?? '');
}

function traceKey(trace: ItfTrace): string {
  return trace.states
    .map(
      (state) =>
        `${state.action}(${Object.entries(state.picks)
          .map(([name, value]) => `${name}=${renderQuint(value)}`)
          .join(',')})`
    )
    .join(' ');
}

export function simulate(options: SimulateOptions): SimulateResult {
  const seed = options.seed ?? quintSeed();
  const invariants = modelInvariants(readFileSync(options.specPath, 'utf8'));
  rmSync(options.outDir, { recursive: true, force: true });
  mkdirSync(options.outDir, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      QUINT_CLI,
      'run',
      options.specPath,
      '--main',
      quintModuleName(options.specPath),
      '--backend',
      'typescript',
      '--mbt',
      '--seed',
      seed,
      '--max-samples',
      String(options.traces),
      '--n-traces',
      String(options.traces),
      '--max-steps',
      String(options.maxSteps),
      '--out-itf',
      join(options.outDir, 'trace-{seq}.itf.json'),
      '--verbosity',
      '2',
      ...(invariants.length === 0 ? [] : ['--invariants', ...invariants]),
    ],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(
      [
        `quint run ${options.specPath} failed (seed ${seed}):`,
        ...(invariants.length === 0
          ? []
          : [`invariants checked: ${invariants.join(', ')}`]),
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter((part) => part.length > 0)
        .join('\n')
    );
  }
  const files = readdirSync(options.outDir)
    .filter((file) => file.endsWith('.itf.json'))
    .sort((a, b) => traceSeq(a) - traceSeq(b));
  const seen = new Set<string>();
  const traces: ItfTrace[] = [];
  for (const file of files) {
    const trace = decodeItfTrace(
      JSON.parse(readFileSync(join(options.outDir, file), 'utf8'))
    );
    const key = traceKey(trace);
    if (seen.has(key)) {
      rmSync(join(options.outDir, file));
      continue;
    }
    seen.add(key);
    traces.push(trace);
  }
  if (traces.length === 0) {
    throw new Error(`quint run ${options.specPath} wrote no traces`);
  }
  // A false `init` draws empty traces without an error (e.g.
  // `x' = a and b` parses as `(x' = a) and b`); replaying one would pass
  // having checked nothing.
  if (traces.some((trace) => trace.states.length === 0)) {
    throw new Error(
      `quint run ${options.specPath} drew an empty trace: its init is never true (note \`x' = a and b\` reads as \`(x' = a) and b\`)`
    );
  }
  return { seed, invariants, traces };
}

function traceSeq(file: string): number {
  return Number(/trace-(\d+)\.itf\.json$/.exec(file)?.[1] ?? 0);
}
