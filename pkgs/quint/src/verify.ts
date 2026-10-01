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

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  APALACHE_VERSION,
  freePort,
  linkQuintHome,
  resolveApalache,
  verifyEnv,
} from './apalache';
import { runQuint } from './run-quint';
import { QUINT_CLI, quintModuleName } from './simulate';
import { wallStopwatch } from './wall';

export type VerifyOptions = {
  /** Absolute path of the `.qnt` model. */
  readonly specPath: string;
  /** The `val`s to require in every reachable state (`invFriendsBothWays`, …). */
  readonly invariants: readonly string[];
  /** Steps after `init` the checker explores, at most. */
  readonly maxSteps: number;
  /** Prove this candidate initially, under every step, and as implying every invariant. */
  readonly inductiveInvariant?: string;
  /** Apalache's working directory and QUINT_HOME (emptied first). */
  readonly outDir: string;
  /** Kill the check (Quint and its Apalache server) after this long. */
  readonly timeoutMs: number;
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
  // Check after the symbolic choice: every enabled transition is retained,
  // with fewer repeated solver queries than checking each branch separately.
  writeFileSync(
    join(options.outDir, 'apalache-config.json'),
    JSON.stringify({
      checker: { tuning: { 'search.invariant.mode': 'after' } },
    })
  );
  const env = verifyEnv({
    env: process.env,
    quintHome: linkQuintHome(options.outDir, apalache.home),
  });
  const port = await freePort();
  const elapsed = wallStopwatch();
  const run = await runQuint({
    args: verifyArgs(options, port),
    cwd: options.outDir,
    env,
    timeoutMs: options.timeoutMs,
  });
  const durationMs = elapsed();
  const strategy =
    options.inductiveInvariant === undefined
      ? `max steps ${String(options.maxSteps)}`
      : `induction: ${options.inductiveInvariant}`;
  const header = `quint verify ${options.specPath} (invariants: ${options.invariants.join(', ')}; ${strategy})`;
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
    return { ok: false, output: `${header} failed:\n${verdict(run.output)}` };
  }
  return { ok: true, durationMs };
}

function verifyArgs(options: VerifyOptions, port: number): string[] {
  return [
    QUINT_CLI,
    'verify',
    options.specPath,
    '--main',
    quintModuleName(options.specPath),
    '--max-steps',
    String(options.maxSteps),
    '--apalache-config',
    join(options.outDir, 'apalache-config.json'),
    '--apalache-version',
    APALACHE_VERSION,
    '--server-endpoint',
    `127.0.0.1:${String(port)}`,
    '--invariants',
    ...options.invariants,
    ...(options.inductiveInvariant === undefined
      ? []
      : ['--inductive-invariant', options.inductiveInvariant]),
  ];
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
