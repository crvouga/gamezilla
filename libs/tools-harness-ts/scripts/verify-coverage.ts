#!/usr/bin/env bun
// @io-wall-ok — coverage reporter composition root
/**
 * `bun run verify:coverage` — executive summary of how much of the workspace's
 * `src` code the `bun test` suite executes and how much of it it asserts on.
 *
 * Runs every package's `bun test` script segment (the package manifest stays
 * the source of truth for which files are in the suite) with bun coverage
 * enabled, then folds the per-run lcov into one report.
 *
 * Options: `--filter=<substring>` (repeatable), `--jobs=<n>`, `--verbose`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, sep } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { testConcurrency } from '@pkgs/os-server-ts/test-concurrency';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import type { FileCoverage } from './lcov';
import { formatLcov, mergeInto, parseLcov } from './lcov';
import type { PackagePlan } from './packages';
import { listPackagePlans } from './packages';
import type { CoverageSummary, ReportMeta } from './report';
import { formatDuration, renderReport, summarize } from './report';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const ARTIFACT_DIR = join(REPO_ROOT, '.cache', 'coverage');
const ARTIFACT_LABEL = '.cache/coverage';
// Instrumented suites need a whole CPU budget to retain their ordinary deadlines.
const DEFAULT_JOBS = 1;
const FAILURE_TAIL_CHARS = 4000;

type Options = {
  readonly filters: readonly string[];
  readonly jobs: number;
  readonly verbose: boolean;
};

type RunSpec = {
  readonly plan: PackagePlan;
  readonly index: number;
  readonly command: string;
};

type RunResult = RunSpec & {
  readonly exitCode: number;
  readonly durationMs: number;
  readonly output: string;
};

function flagValue(
  argv: readonly string[],
  index: number,
  inline: string | undefined
): { readonly value: string; readonly consumed: number } {
  if (inline !== undefined) return { value: inline, consumed: 0 };
  return { value: argv[index + 1] ?? '', consumed: 1 };
}

export function parseOptions(argv: readonly string[]): Options {
  const filters: string[] = [];
  let jobs = DEFAULT_JOBS;
  let verbose = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    const separator = arg.indexOf('=');
    const flag = separator === -1 ? arg : arg.slice(0, separator);
    const inline = separator === -1 ? undefined : arg.slice(separator + 1);
    if (flag === '--verbose' || flag === '-v') {
      verbose = true;
    } else if (flag === '--jobs') {
      const { value, consumed } = flagValue(argv, index, inline);
      index += consumed;
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 1) jobs = Math.floor(parsed);
    } else if (flag === '--filter') {
      const { value, consumed } = flagValue(argv, index, inline);
      index += consumed;
      filters.push(value);
    } else if (!arg.startsWith('-') && arg !== '') {
      filters.push(arg);
    }
  }
  return { filters, jobs, verbose };
}

function matchesFilter(plan: PackagePlan, filters: readonly string[]): boolean {
  if (filters.length === 0) return true;
  return filters.some(
    (filter) =>
      plan.name.includes(filter) || slashPath(plan.dir).includes(filter)
  );
}

function buildSpecs(plans: readonly PackagePlan[]): RunSpec[] {
  const specs: RunSpec[] = [];
  for (const plan of plans) {
    plan.commands.forEach((command, index) => {
      specs.push({ plan, index, command });
    });
  }
  return specs;
}

export function coverageWorkerEnv(
  env: NodeJS.ProcessEnv,
  cpus: number,
  jobs: number
): NodeJS.ProcessEnv {
  const ceiling = Math.max(1, Math.floor(cpus / jobs));
  return {
    ...env,
    VERIFY_TEST_CONCURRENCY: String(testConcurrency(env, ceiling)),
  };
}

/**
 * A test script segment runs under the shell `bun run` would use for it: `sh`
 * on POSIX, Bun's own shell on Windows (no POSIX shell is assumed there). Both
 * handle the segments' quoting, globs and `$(...)` substitutions.
 */
export function scriptShellArgv(
  command: string,
  platform: NodeJS.Platform = process.platform
): readonly string[] {
  return platform === 'win32'
    ? [process.execPath, 'exec', command]
    : ['sh', '-c', command];
}

async function runSpec(
  spec: RunSpec,
  env: NodeJS.ProcessEnv
): Promise<RunResult> {
  const coverageDir = join(spec.plan.coverageRoot, String(spec.index));
  const command = `${spec.command} --coverage --coverage-reporter=lcov --coverage-dir=${JSON.stringify(slashPath(coverageDir))}`;
  const startedAt = Date.now();
  const proc = Bun.spawn([...scriptShellArgv(command)], {
    cwd: spec.plan.dir,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return {
    ...spec,
    exitCode,
    durationMs: Date.now() - startedAt,
    output: `${stdout}${stderr}`,
  };
}

async function runSpecs(
  specs: readonly RunSpec[],
  jobs: number,
  onDone: (result: RunResult) => void
): Promise<RunResult[]> {
  const queue = [...specs];
  const results: RunResult[] = [];
  const env = coverageWorkerEnv(process.env, availableParallelism(), jobs);
  const workers = Array.from(
    { length: Math.max(1, Math.min(jobs, queue.length)) },
    async () => {
      for (;;) {
        const spec = queue.shift();
        if (spec === undefined) return;
        const result = await runSpec(spec, env);
        results.push(result);
        onDone(result);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

function collectIndex(
  results: readonly RunResult[]
): Map<string, FileCoverage> {
  const index = new Map<string, FileCoverage>();
  for (const result of results) {
    const lcovPath = join(
      result.plan.coverageRoot,
      String(result.index),
      'lcov.info'
    );
    if (!existsSync(lcovPath)) continue;
    for (const record of parseLcov(
      readFileSync(lcovPath, 'utf8'),
      result.plan.dir
    )) {
      const { path } = record;
      if (
        !path.startsWith(REPO_ROOT) ||
        path.includes(`${sep}node_modules${sep}`)
      ) {
        continue;
      }
      mergeInto(index, record);
    }
  }
  return index;
}

function reportProgress(
  result: RunResult,
  done: number,
  total: number
): string[] {
  const status =
    result.exitCode === 0 ? 'ok' : `exit ${String(result.exitCode)}`;
  const header = `[coverage] ${String(done).padStart(3)}/${String(total)} ${status.padEnd(7)} ${result.plan.name} (${formatDuration(result.durationMs)})`;
  if (result.exitCode === 0) return [header];
  const tail = result.output.slice(-FAILURE_TAIL_CHARS).trim();
  return [header, tail === '' ? '  (no output)' : tail];
}

function writeArtifacts(
  index: ReadonlyMap<string, FileCoverage>,
  summary: CoverageSummary,
  meta: ReportMeta
): void {
  writeFileSync(join(ARTIFACT_DIR, 'lcov.info'), formatLcov(index, REPO_ROOT));
  writeFileSync(
    join(ARTIFACT_DIR, 'summary.json'),
    `${JSON.stringify({ meta, ...summary }, null, 2)}\n`
  );
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const plans = listPackagePlans(REPO_ROOT);
  const skipped = plans.filter((plan) => plan.commands.length === 0);
  const selected = plans.filter(
    (plan) => plan.commands.length > 0 && matchesFilter(plan, options.filters)
  );
  if (selected.length === 0) {
    process.stderr.write('[coverage] no packages matched\n');
    process.exit(1);
  }
  const specs = buildSpecs(selected);
  removeTree(ARTIFACT_DIR);
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  process.stdout.write(
    `[coverage] ${String(specs.length)} test commands across ${String(selected.length)} packages (jobs=${String(options.jobs)})\n`
  );
  const startedAt = Date.now();
  let done = 0;
  const results = await runSpecs(specs, options.jobs, (result) => {
    done += 1;
    process.stdout.write(
      `${reportProgress(result, done, specs.length).join('\n')}\n`
    );
  });
  const durationMs = Date.now() - startedAt;
  const index = collectIndex(results);
  const summary = summarize(selected, index);
  const failed = results.filter((result) => result.exitCode !== 0);
  const meta: ReportMeta = {
    secretsEnv: process.env['SECRETS_ENV'] ?? 'dev',
    ranPackages: selected.length,
    skipped: skipped.map((plan) => plan.name),
    failed: failed.map(
      (result) => `${result.plan.name} (exit ${String(result.exitCode)})`
    ),
    durationMs,
    artifactDir: ARTIFACT_LABEL,
  };
  writeArtifacts(index, summary, meta);
  process.stdout.write(`\n${renderReport(summary, meta).join('\n')}\n`);
  if (options.verbose) {
    process.stdout.write(`\n  skipped: ${meta.skipped.join(', ') || '-'}\n`);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

if (import.meta.main) await main();
