// @io-wall-ok — codemod CLI (composition root); reads/writes .ts/.tsx files.
/**
 * sx-codemod CLI.
 *
 * Usage:
 *   bun migrate-to-tailwind -- <glob...> [--write]
 *
 * Protection layers (all-or-nothing commit, never a corrupted tree):
 *   1. Report-only by default. Nothing is written without `--write`.
 *   2. `--write` with `--dry-run` together is rejected (ambiguous intent).
 *   3. `--write` is refused unless `git status --porcelain` is clean, so a
 *      bad run is always recoverable with `git checkout`.
 *   4. Unknown flags are rejected instead of silently ignored.
 *   5. A run matching zero files exits non-zero (typo'd globs never read
 *      as success), and no collected path may escape the repo root.
 *   6. Everything transforms in memory first; files with parse failures
 *      abort the whole commit — zero files are written.
 *   7. Idempotence gate: every changed output must re-transform to itself.
 *   8. Completeness gate: leftover sx / purged tags / class helpers abort.
 *   9. Post-write verify: each written file is re-read and byte-compared;
 *      any mismatch exits non-zero with the one-command recovery.
 *
 * File IO lives in this entry module only; everything else in `codemod/`
 * is pure and unit-tested.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { GateHit } from './completeness-gate';
import { formatReport } from './report';
import type { RunResult } from './run-codemod';
import { runCodemod } from './run-codemod';
import { invariant } from './tiger';

export type CliArgs = {
  readonly globs: readonly string[];
  readonly write: boolean;
  readonly dryRun: boolean;
};

const CONFLICT = 'sx-codemod: --write and --dry-run conflict — pick one';

/**
 * Default scan roots (every tree with sx usage, incl. .ts const files).
 *
 * `pkgs/ui/src` / `pkgs/ui/tests` stay in the scan (the corpus gate wants
 * broad coverage) but the transform itself is a no-op on them: they are the
 * design system, whose components legitimately compose `Box` / `Text` /
 * `Stack` and use `joinClass` internally, and whose tests assert on those
 * primitives. Only consumer call sites carry `sx=`.
 */
export const DEFAULT_GLOBS: readonly string[] = [
  'apps/client/src',
  'apps/product',
  'libs',
  'pkgs/ui/src',
  'pkgs/ui/tests',
  'pkgs/sim-console',
  'pkgs/collab-ui',
  'pkgs/chess-board',
  'pkgs/ui-testing-solid-dom',
];

/** Parse argv. Pure; throws on ambiguous or unknown flags. */
export function parseArgs(argv: readonly string[]): CliArgs {
  const globs: string[] = [];
  let write = false;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--write') write = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--')) {
      throw new Error(`sx-codemod: refusing unknown flag ${arg}`);
    } else globs.push(arg);
  }
  if (write && dryRun) throw new Error(CONFLICT);
  if (globs.length === 0) globs.push(...DEFAULT_GLOBS);
  return { globs, write, dryRun };
}

function logPhase(message: string): void {
  process.stdout.write(`sx-codemod: ${message}\n`);
}

function formatGateHits(hits: readonly GateHit[]): string {
  return hits
    .slice(0, 40)
    .map((h) => `  gate ${h.kind} ${h.path}: ${h.detail}`)
    .join('\n');
}

async function gitIsClean(): Promise<boolean> {
  const proc = Bun.spawnSync(['git', 'status', '--porcelain']);
  const out = proc.stdout.toString();
  return proc.exitCode === 0 && out.trim() === '';
}

/** Workspace root (owns `bun.lock`); globs resolve from here, never the cwd. */
function findRepoRoot(): string {
  let dir = resolve(process.cwd());
  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(join(dir, 'bun.lock'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  invariant(false, 'repo root (bun.lock) not found above the cwd');
}

async function collectFiles(
  root: string,
  globs: readonly string[]
): Promise<string[]> {
  const found = new Set<string>();
  for (const glob of globs) {
    const patterns =
      glob.endsWith('.tsx') || glob.endsWith('.ts')
        ? [glob]
        : [
            `${glob.replace(/\/$/, '')}/**/*.tsx`,
            `${glob.replace(/\/$/, '')}/**/*.ts`,
          ];
    for (const pattern of patterns) {
      const scanner = new Bun.Glob(pattern);
      for await (const relative of scanner.scan({ cwd: root, dot: false })) {
        if (relative.endsWith('.d.ts')) continue;
        const absolute = resolve(root, relative);
        invariant(
          absolute === root || absolute.startsWith(`${root}/`),
          `glob escaped the repo root: ${relative}`
        );
        found.add(absolute);
      }
    }
  }
  return [...found].sort();
}

async function verifyWrites(
  writes: readonly { path: string; nextText: string }[]
): Promise<string[]> {
  const bad: string[] = [];
  for (const file of writes) {
    const onDisk = await Bun.file(file.path).text();
    if (onDisk !== file.nextText) bad.push(file.path);
  }
  return bad;
}

/** All-or-nothing preflight: any gate failure writes zero files. */
function gateExitCode(
  result: RunResult
): { code: number; message: string } | undefined {
  if (result.summary.parseFailures > 0) {
    return {
      code: 2,
      message: 'all-or-nothing: parse failures — wrote zero files',
    };
  }
  if (result.unstable.length > 0) {
    return {
      code: 3,
      message: `all-or-nothing: unstable outputs — wrote zero files: ${result.unstable.join(',')}`,
    };
  }
  if (result.gateHits.length > 0) {
    return {
      code: 5,
      message: `all-or-nothing: completeness gate — wrote zero files (${result.gateHits.length} hits)`,
    };
  }
  return undefined;
}

async function commitWrites(result: RunResult): Promise<number> {
  const gate = gateExitCode(result);
  if (gate !== undefined) {
    logPhase(gate.message);
    process.stdout.write(`${formatReport(result.summary)}\n`);
    if (gate.code === 5)
      process.stdout.write(`${formatGateHits(result.gateHits)}\n`);
    return gate.code;
  }
  const writes = result.outputs.filter((o) => o.changed);
  logPhase(`all gates passed — writing ${writes.length} files…`);
  for (const output of writes) {
    await Bun.write(output.path, output.nextText);
  }
  logPhase('verifying written bytes…');
  const bad = await verifyWrites(writes);
  if (bad.length > 0) {
    logPhase(
      `post-write mismatch in ${bad.join(',')} — recover with: git checkout -- ${bad.join(' ')}`
    );
    return 4;
  }
  logPhase('commit complete — tree is converted and verified');
  return 0;
}

async function main(): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(Bun.argv.slice(2));
  } catch (error) {
    process.stdout.write(`${error instanceof Error ? error.message : error}\n`);
    return 1;
  }
  logPhase(
    `mode=${args.write ? 'write (all-or-nothing commit)' : 'dry-run (report only)'}`
  );
  if (args.write && !(await gitIsClean())) {
    logPhase(
      'refusing to write — git tree is not clean (commit or stash first)'
    );
    return 1;
  }
  if (args.write) {
    logPhase(
      'preflight: parse / stability / completeness gates run in-memory before any write'
    );
  }
  logPhase('scanning for .ts/.tsx files…');
  const root = findRepoRoot();
  const paths = await collectFiles(root, args.globs);
  if (paths.length === 0) {
    logPhase('no .ts/.tsx files matched — check your globs');
    return 1;
  }
  logPhase(`transforming ${paths.length} files in memory…`);
  const inputs: Record<string, string> = {};
  for (const path of paths) {
    inputs[path] = await Bun.file(path).text();
  }
  const result = runCodemod(inputs, { dryRun: !args.write });
  if (args.write) return commitWrites(result);
  process.stdout.write(`${formatReport(result.summary)}\n`);
  if (result.summary.parseFailures > 0) return 2;
  if (result.unstable.length > 0) return 3;
  if (result.gateHits.length > 0) {
    logPhase(`completeness gate failed (${result.gateHits.length} hits)`);
    process.stdout.write(`${formatGateHits(result.gateHits)}\n`);
    return 5;
  }
  return 0;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
