/**
 * Shared Turbo flags for CI / local `verify` / `deploy`.
 *
 * - Cache is `local:rw,remote:rw` (Vercel Remote Cache) when `TURBO_TOKEN`
 *   is present (`TURBO_API` and `TURBO_TEAM` are pinned to Vercel and the
 *   constant team slug; telemetry is disabled).
 *   Local disk under `.turbo` is ephemeral in CI. `TURBO_CACHE` may tighten local/remote modes but cannot
 *   drop `remote:` when creds are present.
 * - CI requires `TURBO_TOKEN`. Locally, a missing token (Infisical
 *   login/network fallback) use `local:rw` so `bun verify` still runs.
 * - Disables framework inference so only explicit `turbo.json` `env` /
 *   `globalEnv` enter the hash. Builds explicitly hash public `VITE_*` inputs.
 * - Pins `TURBO_API` to the Vercel Remote Cache, whatever the environment
 *   holds, so no run reads or writes any other remote.
 * - No affected-package filter: every gate task is cached per package, so an
 *   unchanged package is a cache hit, which is the same saving without a
 *   second notion of "what changed" to keep correct. The one input turbo
 *   cannot see — which commits a change adds — is exported as
 *   `VERIFY_SECRETS_RANGE` (`<merge-base>..<head>`) for `verify:secrets`.
 * - Plan first (`turbo-preflight.ts`): `--dry=json` asks the local cache
 *   about every task (~4s), then the remote about the local misses only, in
 *   parallel. All hits → the gate already passed for these inputs, so
 *   turbo is not run at all. Otherwise turbo runs only the missed task ids
 *   (plus their `dependsOn` closure, same hashes), after the closure's remote
 *   hits are prefetched in parallel into the local cache — so `--concurrency`
 *   slots go to real work, not ~400 serialized cross-country cache restores.
 * - Concurrency: honor `TURBO_CONCURRENCY`; otherwise every available CPU
 *   minus the model solvers' reserve. Proofs take machine-wide slots
 *   (`solver-slots.ts`) instead of throttling every task to their needs.
 * - Log order: `auto` locally; `grouped` in CI, which turbo renders as one
 *   collapsible `::group::` per failing task on GitHub Actions. Grouped holds
 *   a task's output until it finishes, so a heartbeat prints every 2 min.
 *   Override with `TURBO_LOG_ORDER`. `verify` expands to package-owned task
 *   names; release expands its dependencies so Turbo runs leaf tasks.
 * - Output logs: `errors-only` — a task's output is printed only when that
 *   task fails, so a green gate prints the plan, the heartbeat and the
 *   summary and nothing a passing test wrote. Override with
 *   `TURBO_OUTPUT_LOGS` (`full` / `new-only`) to watch a run locally.
 * - UI: `turbo.json` selects the terminal UI (`tui`), one pane per task;
 *   turbo falls back to `stream` by itself when stdout is not a terminal.
 *   `TURBO_UI=tui|stream` overrides it here (CI sets `stream`), and a run
 *   started from inside a task always streams: its terminal is that task's
 *   pane.
 * - Time limits: the run is killed at a hard wall-clock deadline, and every
 *   task that executed is verified against its per-task budget once the run
 *   finishes. Both live in `verify-budget.ts`.
 * - Durations: every exit prints the run's wall time and each phase's share
 *   (plan, prefetch, turbo), cache-hit-only runs included.
 * - `--restore-outputs`: leave every task's cached outputs on disk. A plain run skips turbo when everything
 *   hit, which is right for a verdict but restores nothing; this mode
 *   prefetches every remote hit, runs turbo over the whole set (hits restore
 *   their outputs, misses run) and `--continue`s past a failing task so every
 *   suite reports.
 * - `--publish-reports`: restore assigned cached spec parts and publish each
 *   completed part from Turbo's structured stream. Uploads have their own
 *   bounded pool, overlap verifications, and must finish before the gate passes.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { writeSpecInputs } from '@libs/harness-ts/spec-inputs';
import { TURBO_API, TURBO_TEAM } from '@libs/secrets-shared-ts/turbo-token';
import { killOrphanEsbuildServices } from '@pkgs/dev-owner-server-ts/kill-orphan-esbuild';
import { capture } from '@pkgs/os-server-ts/command';
import { captureAudit } from './audit-snapshot';
import { killProcessTree } from './kill-process-tree';
import {
  ciFilters,
  hostFilters,
  isDefaultHost,
  isHost,
  workspaceManifests,
  writeHostKey,
} from './package-hosts';
import { describeRunningTasks } from './running-tasks';
import { SECRETS_RANGE_ENV, secretsScanRange } from './secrets-scan-range';
import { solverSlots } from './solver-slots';
import { MAX_MODEL_PARTS, MAX_SPEC_PARTS } from './spec-packages';
import type { RunPlan } from './turbo-preflight';
import {
  dryRunPlan,
  localCacheFlag,
  prefetchRemoteHits,
  REMOTE_LOOKUP_CONCURRENCY,
  readsRemoteCache,
  resolveRemoteHits,
  restoreEveryHit,
  restoreSelectedReports,
  wallRemoteHas,
} from './turbo-preflight';
import {
  DEADLINE_FLUSH_MS,
  findBudgetOverruns,
  formatBudgetOverruns,
  gateExitCode,
  RUN_DEADLINE_ENV,
  readLatestRunSummary,
  resolveRunDeadlineSeconds,
  slowCiRunner,
  slowestExecuted,
} from './verify-budget';
import { verifyCacheConcurrency } from './verify-cache-concurrency';
import {
  activeProfile,
  applyProfileEnv,
  suiteDeadlineSeconds,
  verifyAggregatorTasks,
} from './verify-profile';
import { completeReports, prepareReports } from './verify-report-lifecycle';
import { observeReportOutput } from './verify-report-run';
import type { ReportTaskIdentity } from './verify-report-stream';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const DEPLOY_AGGREGATOR = '//#deploy';
/**
 * The release journeys run as this many tasks, each a share of the features
 * (`apps/product-ts/scripts/test-release-journeys.ts --part=<k>/<n>`): one
 * process outran its 600 s task budget and killed the shard.
 */
export const RELEASE_JOURNEY_PARTS = 3;
export const RELEASE_JOURNEY_TASKS = Array.from(
  { length: RELEASE_JOURNEY_PARTS },
  (_, part) => `@apps/product-ts#test:release-journeys:${String(part)}`
);
export const MAIN_VERIFY_TASKS = [
  '@libs/tools-harness-ts#verify:root-lint',
  '@libs/tools-harness-ts#ci:syncpack',
  '@libs/tools-harness-ts#ci:audit',
  '@libs/tools-harness-ts#ci:i18n',
  '@libs/tools-harness-ts#ci:agent-commands',
  '@libs/tools-harness-ts#ci:workspace-lifecycle',
  '@libs/tools-harness-ts#ci:cache-hygiene',
  '@libs/tools-harness-ts#ci:package-names',
  '@libs/tools-harness-ts#ci:goals',
  '@libs/tools-harness-ts#ci:specs',
  '@libs/tools-harness-ts#ci:statecharts',
  '@libs/tools-harness-ts#ci:conformance',
  '@libs/tools-harness-ts#ci:spec-ownership',
  '@pkgs/ui-root-harness-ts#ci:storybook',
  'tc',
  'lint',
  'test',
  'test:contract',
  'test:contract:render',
  // One symbolic model per task. The whole product suite outruns one runner.
  ...Array.from({ length: 11 }, (_, index) => `test:contract:${String(index)}`),
  ...Array.from(
    { length: MAX_SPEC_PARTS },
    (_, index) => `test:spec:${String(index)}`
  ),
  'verify:models',
  // The parts of a split models verification (`MAX_MODEL_PARTS` in spec-packages).
  ...Array.from(
    { length: MAX_MODEL_PARTS },
    (_, index) => `verify:models:${String(index)}`
  ),
  'test:unit:1',
  'test:unit:2',
  '@apps/product-ts#verify:offline-shell',
  ...RELEASE_JOURNEY_TASKS,
  '@apps/auth-relay-ts#verify:worker-bundle',
  '@apps/product-ts#verify:worker-bundle',
  '@apps/product-ts#verify:rendered-worker',
  '@libs/runtime-server-ts#verify:schema-evolution',
  '@libs/tools-harness-ts#verify:actionlint',
  '@libs/tools-harness-ts#verify:brand-policy',
  '@libs/tools-harness-ts#verify:rebrand',
  '@libs/tools-harness-ts#verify:secrets',
  '@libs/tools-harness-ts#verify:workflow-security',
  'verify:board-contract',
  '@apps/synthetic-population-worker-ts#verify:synthetic-population-foundation',
] as const;

/**
 * The live health verifications and critical journeys (`@apps/product-ts#health`,
 * `@synthetic` features + `specs/journeys/`). Deliberately no `//#health` root
 * task: the root `health` script would make a bare `health` dependency
 * resolve to that root task itself, a cycle turbo refuses to plan.
 */
const HEALTH_TASK = 'health';

const PLATFORM_KEY_PATH = join(REPO_ROOT, 'turbo-platform-key.json');

/**
 * The most traces of one Quint model a run replays through the product
 * (`@pkgs/quint-shared-ts/wall`). The `release` profile leaves it unset, which
 * is the smallest bounded selection; the `nightly` profile sets `all`
 * (`verify-profile.ts`).
 */
export const REPLAY_BUDGET_ENV = 'QUINT_REPLAY_TRACES';

/**
 * Turborepo's hash knows nothing about the platform
 * (https://turborepo.dev/docs/guides/handling-platforms), so a macOS result
 * could satisfy a Linux run. Tests, contracts and browser builds declare
 * this file as an input, so native runtime and browser differences cannot
 * reuse each other's verdicts. Portable tc/lint tasks can still share a
 * cache across machines. Written on every run: absent
 * (a bare `turbo run`) hashes differently, which costs a cache miss, never
 * correctness. Native (Swift) tasks hash only the operating system and CPU
 * (`turbo-host-key.json`, `package-hosts.ts`), so the Linux plan can predict
 * the Apple job's hashes without knowing that runner's browser.
 */
export function writePlatformCacheKey(): void {
  writeHostKey(REPO_ROOT);
  const key = {
    platform: process.platform,
    arch: process.arch,
    bun: Bun.version,
    chrome: visualBrowserVersion(),
  };
  writeFileSync(PLATFORM_KEY_PATH, `${JSON.stringify(key, null, 2)}\n`);
  writeSpecInputs(REPO_ROOT);
}

/** Browser pixels must not reuse a verdict from another Chrome version. */
function visualBrowserVersion(): string | null {
  const result = capture(
    process.execPath,
    ['run', join(REPO_ROOT, 'apps/product-ts/scripts/browser-version.ts')],
    { cwd: REPO_ROOT }
  );
  if (result.status !== 0)
    throw new Error(`Cannot fingerprint visual renderer: ${result.stderr}`);
  const value = JSON.parse(result.stdout) as { chrome?: unknown };
  if (value.chrome !== null && typeof value.chrome !== 'string')
    throw new Error('Invalid visual renderer fingerprint.');
  return value.chrome;
}

/** Root-package script names and turbo root-task aliases that are aggregators. */
const AGGREGATOR_ALIASES: Readonly<Record<string, string>> = {
  deploy: DEPLOY_AGGREGATOR,
  '//#deploy': DEPLOY_AGGREGATOR,
  '//:deploy': DEPLOY_AGGREGATOR,
};

/**
 * `deploy`: the full release graph. `health`: live-resource probes only —
 * the `health` tasks declare the release chain in `dependsOn` so release orders
 * them last, and a standalone health run passes turbo's `--only` so it probes
 * what is live without releasing anything. `plain`: everything else.
 */
export type RunMode = 'deploy' | 'health' | 'plain';

export function resolveRunMode(rawTaskArgs: readonly string[]): RunMode {
  const requested = new Set(
    rawTaskArgs
      .filter((arg) => Object.hasOwn(AGGREGATOR_ALIASES, arg))
      .map((arg) => AGGREGATOR_ALIASES[arg])
  );
  if (requested.has(DEPLOY_AGGREGATOR)) return 'deploy';
  if (rawTaskArgs.includes(HEALTH_TASK)) return 'health';
  return 'plain';
}

/**
 * Turbo flags a run mode adds. Standalone health: `--only` keeps it off the
 * release chain, and `--continue` lets every probe report instead of stopping at
 * the first failure (probes are independent and release nothing). Release keeps
 * turbo's stop-on-first-failure: some release steps do not depend on the full
 * verification surface, so continuing past a failed verification could ship.
 */
export function runModeFlags(mode: RunMode): readonly string[] {
  return mode === 'health'
    ? ['--only', '--continue=dependencies-successful']
    : [];
}

const TURBO_CACHE_RE = /^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/;
const TURBO_UI_VALUES = new Set(['tui', 'stream']);
const DEFAULT_CACHE = 'local:rw,remote:rw';
const LOCAL_ONLY_CACHE = 'local:rw';
const CACHE_WORKERS = 16;

type TurboTasks = Record<string, { dependsOn?: unknown }>;

function inGithubActions(): boolean {
  return process.env['GITHUB_ACTIONS'] === 'true';
}

function inCi(): boolean {
  return inGithubActions() || process.env['CI'] === 'true';
}

export function hasRemoteCreds(env: NodeJS.ProcessEnv): boolean {
  const token = env['TURBO_TOKEN']?.trim();
  return token !== undefined && token.length > 0;
}

function ensureRemoteCache(cache: string): string {
  if (cache.includes('remote:')) return cache;
  return `${cache},remote:rw`;
}

export function resolveCacheFlag(
  env: NodeJS.ProcessEnv,
  hasRemote: boolean
): string {
  if (!hasRemote) return LOCAL_ONLY_CACHE;
  const fromEnv = env['TURBO_CACHE']?.trim();
  if (
    fromEnv !== undefined &&
    fromEnv.length > 0 &&
    TURBO_CACHE_RE.test(fromEnv)
  ) {
    if (fromEnv.includes(',')) return ensureRemoteCache(fromEnv);
    if (fromEnv.startsWith('remote:')) return `local:rw,${fromEnv}`;
    return ensureRemoteCache(fromEnv);
  }

  return DEFAULT_CACHE;
}

/**
 * Every core but one per solver slot runs a task; the solvers gate themselves
 * machine-wide (`solver-slots.ts`). Nearly every task is one core of work.
 */
export function defaultVerifyConcurrency(
  cpus: number,
  slots: number = solverSlots(process.env, cpus)
): number {
  return Math.max(1, cpus - slots);
}

function resolveConcurrency(): string {
  const fromEnv = process.env['TURBO_CONCURRENCY']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return String(defaultVerifyConcurrency(availableParallelism()));
}

/** The `--ui` to force; undefined leaves the choice to `turbo.json`. */
export function resolveUi(env: NodeJS.ProcessEnv): string | undefined {
  // Turbo sets TURBO_HASH for every task it runs.
  if (env['TURBO_HASH'] !== undefined) return 'stream';
  const fromEnv = env['TURBO_UI']?.trim();
  if (
    fromEnv !== undefined &&
    fromEnv.length > 0 &&
    TURBO_UI_VALUES.has(fromEnv)
  ) {
    return fromEnv;
  }
  return undefined;
}

/**
 * Turbo child env: telemetry off, and for the Vercel Remote Cache the
 * constant `TURBO_TEAM` and `TURBO_API`.
 */
export function turboChildEnv(
  source: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    TURBO_TELEMETRY_DISABLED: '1',
    RAYON_NUM_THREADS: '1',
    VERIFY_LINT_THREADS: '1',
    GOMAXPROCS: '1',
    MODEL_VERIFY_CONCURRENCY: '2',
    JAVA_TOOL_OPTIONS: '-XX:ActiveProcessorCount=2',
    JVM_GC_ARGS: '-XX:+UseParallelGC -Xmx4096m -Xms128m',
    ...source,
  };
  // A workflow can only set a variable to empty, never leave it unset, and
  // turbo hashes the two apart: an empty replay budget is the default one,
  // the same verdict as none.
  if ((env[REPLAY_BUDGET_ENV]?.trim() ?? '') === '')
    delete env[REPLAY_BUDGET_ENV];
  applyProfileEnv(env);
  if (!hasRemoteCreds(env)) return env;
  env['TURBO_TEAM'] = TURBO_TEAM;
  env['TURBO_API'] = TURBO_API;
  return env;
}

function loadTurboTasks(): TurboTasks {
  const turboJson = JSON.parse(
    readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')
  ) as { tasks?: TurboTasks };
  if (turboJson.tasks === undefined) {
    throw new Error('turbo.json missing tasks');
  }
  return turboJson.tasks;
}

function taskDependsOn(tasks: TurboTasks, taskName: string): string[] {
  const deps = tasks[taskName]?.dependsOn;
  if (!Array.isArray(deps)) {
    throw new Error(`turbo.json missing ${taskName} dependsOn`);
  }
  return deps.filter((dep): dep is string => typeof dep === 'string');
}

/** `verify:linux`, `verify:macos`: the gate on one host's packages. */
const HOST_AGGREGATOR = /^verify:([a-z]+)$/;

/** `verify:ci`: the gate CI runs, on any runner OS (`ciVerifyArgs`). */
const CI_AGGREGATOR = 'verify:ci';

/**
 * The gate as CI runs it: every gate task over the packages that run on
 * Linux, macOS and Windows alike (`package-hosts.ts` `ciFilters`).
 */
export function ciVerifyArgs(
  manifests = workspaceManifests(REPO_ROOT)
): readonly string[] {
  return [...MAIN_VERIFY_TASKS, ...ciFilters(manifests)];
}

/**
 * The gate as one host runs it (`package-hosts.ts`): the gate tasks over the
 * packages that host verifies. The gates one named package owns
 * (`@libs/tools-harness-ts#ci:*`) are the default host's alone.
 */
export function hostVerifyArgs(
  host: Parameters<typeof hostFilters>[1],
  manifests = workspaceManifests(REPO_ROOT)
): readonly string[] {
  return [
    ...MAIN_VERIFY_TASKS.filter(
      (task) => isDefaultHost(host) || !task.includes('#')
    ),
    ...hostFilters(manifests, host),
  ];
}

/**
 * Expand the verification command to package tasks; recursively expand release's
 * package dependencies to leaf turbo tasks.
 * Dedupes while preserving first-seen order.
 */
export function flattenVerifyAggregators(
  taskArgs: readonly string[],
  tasks: TurboTasks = loadTurboTasks()
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function pushLeaf(leaf: string): void {
    if (seen.has(leaf)) return;
    seen.add(leaf);
    out.push(leaf);
  }

  // Bare script names are command aliases only here. In Turbo's graph they
  // remain package tasks with their package-scoped meaning.
  function expand(arg: string, commandLine: boolean): void {
    if (commandLine && arg === CI_AGGREGATOR) {
      for (const leaf of ciVerifyArgs()) pushLeaf(leaf);
      return;
    }
    const host = commandLine ? HOST_AGGREGATOR.exec(arg)?.[1] : undefined;
    if (host !== undefined && isHost(host)) {
      for (const leaf of hostVerifyArgs(host)) pushLeaf(leaf);
      return;
    }
    const verifications = commandLine
      ? verifyAggregatorTasks(arg, MAIN_VERIFY_TASKS)
      : null;
    if (verifications !== null) {
      for (const task of verifications) pushLeaf(task);
      return;
    }
    const isAlias = Object.hasOwn(AGGREGATOR_ALIASES, arg);
    const canonical =
      isAlias && (commandLine || arg.startsWith('//'))
        ? AGGREGATOR_ALIASES[arg]
        : undefined;
    if (canonical === undefined) {
      pushLeaf(arg);
      return;
    }
    for (const dep of taskDependsOn(tasks, canonical)) {
      expand(dep, false);
    }
  }

  for (const arg of taskArgs) {
    expand(arg, true);
  }

  return out;
}

function requireRemoteCredsInCi(hasRemote: boolean): void {
  if (hasRemote || !inCi()) return;
  console.error(
    'turbo-ci-run: TURBO_TOKEN is required for the Vercel Remote Cache. ' +
      'Run via secrets-run / secrets-auth (Infisical) so local warms upload and CI reuses them.'
  );
  process.exit(1);
}

function warnLocalCacheOnly(hasRemote: boolean): void {
  if (hasRemote) return;
  console.warn(
    'turbo-ci-run: TURBO_TOKEN missing; using local cache only. ' +
      'Run `bun run secrets:pull` so local warms upload to the Vercel Remote Cache.'
  );
}

/** Release writes remote artifacts CI reuses; it never runs cache-local. */
function requireRemoteCredsForDeploy(hasRemote: boolean, mode: RunMode): void {
  if (hasRemote || mode !== 'deploy') return;
  console.error(
    'turbo-ci-run: release requires TURBO_TOKEN. ' +
      'Run `bun run secrets:pull` then retry via secrets-run.'
  );
  process.exit(1);
}

/** Each phase's wall time, in the order the phases ran. */
export type PhaseDurations = readonly (readonly [phase: string, ms: number])[];

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** `turbo-ci-run: finished in 9.1s (plan 1.2s, prefetch 0.3s, turbo 7.6s)` */
export function formatDurations(
  totalMs: number,
  phases: PhaseDurations
): string {
  const parts = phases.map(([phase, ms]) => `${phase} ${formatSeconds(ms)}`);
  return (
    `turbo-ci-run: finished in ${formatSeconds(totalMs)}` +
    (parts.length > 0 ? ` (${parts.join(', ')})` : '')
  );
}

const STARTED = process.hrtime.bigint();
const phases: [phase: string, ms: number][] = [];

function msSince(start: bigint): number {
  return Number((process.hrtime.bigint() - start) / 1_000_000n);
}

async function timed<T>(phase: string, run: () => T | Promise<T>): Promise<T> {
  const start = process.hrtime.bigint();
  try {
    return await run();
  } finally {
    phases.push([phase, msSince(start)]);
  }
}

function exitWithDurations(code: number): never {
  console.log(formatDurations(msSince(STARTED), phases));
  process.exit(code);
}

function turboCiFlags(
  cache: string,
  logOrder: string,
  ui: string | undefined,
  publishReports: boolean
): string[] {
  const TURBO_OUTPUT_LOGS =
    process.env['TURBO_OUTPUT_LOGS']?.trim() || 'errors-only';
  const TURBO_CI_FLAGS = [
    `--concurrency=${resolveConcurrency()}`,
    `--cache-workers=${String(verifyCacheConcurrency(process.env, CACHE_WORKERS))}`,
    `--cache=${cache}`,
    '--framework-inference=false',
    '--summarize',
    `--output-logs=${TURBO_OUTPUT_LOGS}`,
    `--log-order=${logOrder}`,
    ...(ui !== undefined ? [`--ui=${ui}`] : []),
  ] as const;
  return publishReports
    ? [
        ...TURBO_CI_FLAGS.filter(
          (arg) => !/^--(output-logs|log-order|ui)=/.test(arg)
        ),
        '--json',
        '--output-logs=full',
        '--continue=dependencies-successful',
      ]
    : [...TURBO_CI_FLAGS, ...keepGoingFlags()];
}

/**
 * The nightly profile lets every independent task report. A run restoring
 * outputs already continues past a failure.
 */
function keepGoingFlags(): readonly string[] {
  return activeProfile().continueAfterFailure &&
    !process.argv.includes(RESTORE_OUTPUTS_FLAG)
    ? ['--continue=dependencies-successful']
    : [];
}

function cliTaskArgs(): string[] {
  const args = process.argv
    .slice(2)
    .filter(
      (arg) => ![RESTORE_OUTPUTS_FLAG, PUBLISH_REPORTS_FLAG].includes(arg)
    );
  if (args.length === 0) {
    console.error(
      'usage: bun run libs/tools-harness-ts/scripts/turbo-ci-run.ts <turbo run args…>'
    );
    process.exit(1);
  }
  return args;
}

async function main(): Promise<void> {
  const env = turboChildEnv();
  writePlatformCacheKey();
  const remote = hasRemoteCreds(env);
  requireRemoteCredsInCi(remote);
  warnLocalCacheOnly(remote);
  const cache = resolveCacheFlag(env, remote);
  const TURBO_LOG_ORDER =
    process.env['TURBO_LOG_ORDER']?.trim() || (inCi() ? 'grouped' : 'auto');
  const ui = resolveUi(process.env);

  const restoreOutputs = process.argv.includes(RESTORE_OUTPUTS_FLAG);
  const publishReports = process.argv.includes(PUBLISH_REPORTS_FLAG);
  const rawTaskArgs = cliTaskArgs();

  const mode = resolveRunMode(rawTaskArgs);
  requireRemoteCredsForDeploy(remote, mode);
  const taskArgs = prepareTaskArgs(rawTaskArgs);
  env[SECRETS_RANGE_ENV] = secretsScanRange(env);

  const ci = inCi();
  const slowRunner = slowCiRunner(ci, availableParallelism());
  const deadlineSeconds = deadlineFor(rawTaskArgs, mode, slowRunner, ci);

  console.log(
    `turbo-ci-run: cache=${cache} concurrency=${resolveConcurrency()} log-order=${TURBO_LOG_ORDER} deadline=${Number.isFinite(deadlineSeconds) ? `${String(deadlineSeconds)}s` : 'none'}` +
      (ui !== undefined ? ` ui=${ui}` : '') +
      (remote
        ? ` (remote creds present; api=${env['TURBO_API'] ?? TURBO_API}; team=${env['TURBO_TEAM'] ?? TURBO_TEAM})`
        : ' (local cache only)')
  );

  const fullRunArgs = [
    'run',
    ...taskArgs,
    ...rootExcludeFiltersFor(taskArgs),
    ...runModeFlags(mode),
  ];
  const planned = await timed('plan', () =>
    planOrNull(fullRunArgs, cache, env)
  );
  if (publishReports && planned === null)
    throw new Error('Verify report publication requires an exact gate plan');
  const restore = restoreOutputs;
  const { plan, missingReports } = await prepareRunPlan({
    planned,
    publishReports,
    restore,
    env,
  });
  if (plan !== null && plan.toExecute.length === 0 && !restore) {
    if (publishReports)
      await timed('report-close', () => completeReports(0, env));
    exitWithDurations(finalExitCode({ status: 0, slowRunner, ran: false }));
  }
  if (plan !== null && plan.remoteHits.length > 0) {
    await timed('prefetch', () => prefetchRemoteHits(plan, REPO_ROOT, env));
  }
  const runArgs = turboRunArgs(fullRunArgs, plan, restore);
  const flags = turboCiFlags(cache, TURBO_LOG_ORDER, ui, publishReports);

  const stopHeartbeat = startHeartbeat();
  const status = await timed('turbo', () =>
    runTurbo(
      [
        ...runArgs.filter((arg) => !publishReports || arg !== '--continue'),
        ...flags,
      ],
      env,
      { deadlineSeconds },
      publishReports
        ? plan?.tasks.filter((task) => missingReports.includes(task.taskId))
        : undefined
    )
  );
  stopHeartbeat();

  // Reap any esbuild --service workers orphaned by force-exited tasks.
  killOrphanEsbuildServices({ commandIncludes: REPO_ROOT });
  exitWithDurations(
    await finishRun({ status, slowRunner, env, publishReports })
  );
}

function runDeadlineSeconds(
  mode: RunMode,
  slowRunner: boolean,
  ci: boolean
): number {
  return resolveRunDeadlineSeconds(process.env, {
    isDeploy: mode === 'deploy',
    slowRunner,
    warmRunner: ci && !slowRunner,
  });
}

/**
 * A run of nightly suites has their deadline; `VERIFY_DEADLINE_SECONDS` still
 * outranks it, as it does every default.
 */
function deadlineFor(
  rawTaskArgs: readonly string[],
  mode: RunMode,
  slowRunner: boolean,
  ci: boolean
): number {
  const runDeadline = runDeadlineSeconds(mode, slowRunner, ci);
  if (!Number.isFinite(runDeadline)) return runDeadline;
  const override = Number.parseInt(
    process.env[RUN_DEADLINE_ENV]?.trim() ?? '',
    10
  );
  const suite =
    Number.isInteger(override) && override > 0
      ? null
      : suiteDeadlineSeconds(rawTaskArgs);
  return suite ?? runDeadline;
}

function prepareTaskArgs(raw: readonly string[]): string[] {
  const args = flattenVerifyAggregators(raw);
  if (args.includes('@libs/tools-harness-ts#ci:audit')) captureAudit(REPO_ROOT);
  return args;
}

async function prepareRunPlan(args: {
  readonly planned: RunPlan | null;
  readonly publishReports: boolean;
  readonly restore: boolean;
  readonly env: NodeJS.ProcessEnv;
}): Promise<{ plan: RunPlan | null; missingReports: readonly string[] }> {
  if (args.publishReports) {
    if (args.planned === null)
      throw new Error('Verify report publication requires an exact gate plan');
    const missingReports = await timed('report-prepare', () =>
      prepareReports(args.planned!, args.env)
    );
    return {
      plan: restoreSelectedReports(args.planned, missingReports),
      missingReports,
    };
  }
  return {
    plan:
      args.restore && args.planned
        ? restoreEveryHit(args.planned)
        : args.planned,
    missingReports: [],
  };
}

async function finishRun(args: {
  readonly status: number;
  readonly slowRunner: boolean;
  readonly env: NodeJS.ProcessEnv;
  readonly publishReports: boolean;
}): Promise<number> {
  let verdict = finalExitCode({
    status: args.status,
    slowRunner: args.slowRunner,
    ran: true,
  });
  if (args.publishReports && args.status !== 124) {
    try {
      await timed('report-close', () => completeReports(verdict, args.env));
    } catch (error) {
      console.error(error);
      verdict = 1;
    }
  }
  return verdict;
}

/**
 * What turbo runs once the plan is in: only the misses (their `dependsOn`
 * closure comes along with the same hashes), or — restoring outputs — the
 * whole set, so every hit restores its outputs, continuing past a failure.
 */
function turboRunArgs(
  fullRunArgs: readonly string[],
  plan: RunPlan | null,
  restoreOutputs: boolean
): string[] {
  if (restoreOutputs) return [...fullRunArgs, '--continue'];
  if (plan === null) return [...fullRunArgs];
  return ['run', ...plan.toExecute.map((task) => task.taskId)];
}

const RESTORE_OUTPUTS_FLAG = '--restore-outputs';
const PUBLISH_REPORTS_FLAG = '--publish-reports';

/**
 * Exclude the root workspace from package tasks so root scripts like `lint`
 * (which themselves call turbo-ci-run) are never scheduled.
 */
function rootExcludeFiltersFor(taskArgs: readonly string[]): string[] {
  const hasExplicitFilter = taskArgs.some((a) => a.startsWith('--filter='));
  // `pkg#task` ids name their package already; only bare task names need
  // the root workspace excluded.
  const hasPackageTasks = taskArgs.some(
    (a) => !a.startsWith('//') && !a.startsWith('--') && !a.includes('#')
  );
  if (hasExplicitFilter || !hasPackageTasks) return [];
  const filters = [
    '--filter=./apps/*',
    '--filter=./libs/*',
    '--filter=./pkgs/*',
  ];
  if (taskArgs.some((a) => a.startsWith('//'))) filters.push('--filter=//');
  return filters;
}

const LISTED_MISSES = 25;

/**
 * Dry-run the exact task set (see `turbo-preflight.ts`). `null` when the dry
 * run itself fails: the real run then goes ahead unplanned — the verdict is
 * always the real run's, the plan only decides how much of it to skip.
 */
async function planOrNull(
  runArgs: readonly string[],
  cache: string,
  env: NodeJS.ProcessEnv
): Promise<RunPlan | null> {
  // The misses are re-run by id alone, so a caller's own turbo flags
  // (`--force`, `--continue`, …) would be dropped: plan only plain task sets.
  const flags = runArgs.filter((arg) => arg.startsWith('-'));
  if (flags.some((flag) => !flag.startsWith('--filter='))) return null;
  // Turbo's own remote lookup is one request per task, in series; ask the
  // local cache here and the remote about the local misses, in parallel.
  const local = localCacheFlag(cache);
  const askRemote = local !== null && readsRemoteCache(cache);
  let plan: RunPlan;
  try {
    plan = dryRunPlan(
      [...runArgs, `--cache=${local ?? cache}`, '--framework-inference=false'],
      REPO_ROOT,
      env
    );
    if (askRemote && plan.toExecute.length > 0) {
      plan = await resolveRemoteHits(
        plan,
        wallRemoteHas(env),
        REMOTE_LOOKUP_CONCURRENCY
      );
    }
  } catch (error) {
    console.warn(
      `turbo-ci-run: dry run failed (${String(error)}); running unplanned.`
    );
    return null;
  }
  const cached = plan.tasks.length - plan.toExecute.length;
  console.log(
    `turbo-ci-run: ${String(plan.tasks.length)} tasks — ${String(cached)} cached, ` +
      `${String(plan.toExecute.length)} to execute`
  );
  for (const task of plan.toExecute.slice(0, LISTED_MISSES)) {
    console.log(`  miss  ${task.taskId}`);
  }
  if (plan.toExecute.length > LISTED_MISSES) {
    console.log(
      `  … and ${String(plan.toExecute.length - LISTED_MISSES)} more`
    );
  }
  if (plan.toExecute.length === 0) {
    console.log(
      'turbo-ci-run: every task is a cache hit (a cached result is a passed ' +
        'result for these exact inputs); nothing to run.'
    );
  }
  return plan;
}

const HEARTBEAT_MS = 120_000;

/**
 * GitHub SIGTERMs a step that prints nothing for ~10 min (exit 143), and the
 * grouped log order holds each task's output until it finishes. A heartbeat
 * in-process — not a background shell loop, whose orphaned `sleep` held the
 * step's stdout open for seconds after the run was done.
 */
function startHeartbeat(): () => void {
  if (!inGithubActions()) return () => undefined;
  const started = process.hrtime.bigint();
  const timer = setInterval(() => {
    const seconds = Number(
      (process.hrtime.bigint() - started) / 1_000_000_000n
    );
    console.log(`turbo-ci-run: still running (${String(seconds)}s)`);
  }, HEARTBEAT_MS);
  return () => clearInterval(timer);
}

/**
 * Zero only when turbo passed and every executed task was inside its budget.
 */
function finalExitCode(args: {
  readonly status: number;
  readonly slowRunner: boolean;
  /** False when the plan found nothing to execute: no summary to measure. */
  readonly ran: boolean;
}): number {
  // The timing table prints even when a task failed — that is exactly when
  // someone is reading the log and wants to know where the time went.
  const budget = args.ran ? enforceTaskBudgets(args.slowRunner) : 0;
  if (args.status !== 0) return args.status;
  return budget;
}

/**
 * Fail a run whose tasks were individually too slow. Read from turbo's own
 * `--summarize` output, so cache hits (which did no work) are never measured.
 */
function enforceTaskBudgets(slowRunner: boolean): number {
  const summary = readLatestRunSummary(REPO_ROOT);
  if (summary === null) {
    console.warn(
      'turbo-ci-run: no turbo run summary found; per-task budgets not verified.'
    );
    return 0;
  }
  // Print it every run: without this the CI log says how long the whole gate
  // took and nothing about where it went, and the only way to find the slow
  // task was to guess.
  const slowest = slowestExecuted(summary, 10);
  if (slowest.length > 0) {
    console.log('turbo-ci-run: slowest tasks that ran');
    for (const row of slowest) {
      console.log(`  ${String(row.seconds).padStart(5)}s  ${row.taskId}`);
    }
  }
  const overruns = findBudgetOverruns(summary, slowRunner);
  if (overruns.length === 0) return 0;
  console.error(formatBudgetOverruns(overruns));
  return 1;
}

type RunTurboOptions = {
  readonly deadlineSeconds: number;
};

/** Stop detached task groups and workers as well as turbo itself. */
function killTree(child: ChildProcess, signal: NodeJS.Signals): void {
  const pid = child.pid;
  if (pid !== undefined) killProcessTree(pid, signal);
}

/**
 * Kill the run at `deadlineSeconds`. Returns a disarm callback.
 *
 * On POSIX `detached: true` puts turbo in its own process group so the whole
 * tree dies with it; the price is that the terminal's Ctrl-C no longer reaches
 * it, so SIGINT / SIGTERM are forwarded here instead. Windows has no catchable
 * SIGTERM: there the flush signal is already the hard kill.
 */
function armDeadline(
  child: ChildProcess,
  deadlineSeconds: number,
  stopReports: () => void
): { readonly disarm: () => void; readonly deadlineHit: () => boolean } {
  let deadlineHit = false;
  const forward = (signal: NodeJS.Signals) => () => {
    stopReports();
    killTree(child, signal);
  };
  const onInt = forward('SIGINT');
  const onTerm = forward('SIGTERM');
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);
  const termAt = Number.isFinite(deadlineSeconds)
    ? setTimeout(() => {
        deadlineHit = true;
        console.error(
          `turbo-ci-run: hard deadline of ${String(deadlineSeconds)}s reached; asking turbo to flush finished cache uploads.`
        );
        if (child.pid !== undefined) {
          console.error(describeRunningTasks(child.pid, REPO_ROOT));
        }
        killTree(child, 'SIGTERM');
      }, deadlineSeconds * 1000)
    : undefined;
  const killAt = Number.isFinite(deadlineSeconds)
    ? setTimeout(
        () => {
          deadlineHit = true;
          console.error(
            `turbo-ci-run: cache flush window of ${String(DEADLINE_FLUSH_MS)}ms elapsed; killing the run.`
          );
          console.error(
            'turbo-ci-run: tasks that finished before the kill are cached, so a ' +
              'rerun resumes from here. Fix a wedged task, or raise the deadline in ' +
              'libs/tools-harness-ts/scripts/verify-budget.ts with the measurement.'
          );
          killTree(child, 'SIGKILL');
          stopReports();
        },
        deadlineSeconds * 1000 + DEADLINE_FLUSH_MS
      )
    : undefined;
  return {
    deadlineHit: () => deadlineHit,
    disarm: () => {
      clearTimeout(termAt);
      clearTimeout(killAt);
      process.off('SIGINT', onInt);
      process.off('SIGTERM', onTerm);
    },
  };
}

/** Run turbo to completion or until the deadline. */
function runTurbo(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options: RunTurboOptions,
  reportTasks?: readonly ReportTaskIdentity[]
): Promise<number> {
  const child = spawn('turbo', args, {
    stdio:
      reportTasks === undefined ? 'inherit' : ['inherit', 'pipe', 'inherit'],
    env,
    // A process group to kill on POSIX; on Windows a detached child gets a
    // console of its own, and `killProcessTree` walks the tree instead.
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
  const uploads = new AbortController();
  const deadline = armDeadline(child, options.deadlineSeconds, () =>
    uploads.abort()
  );
  const reports =
    reportTasks === undefined
      ? Promise.resolve()
      : observeReportOutput(child, reportTasks, env, uploads.signal);
  // Observe upload errors immediately; return a failed verdict after every upload settles.
  const publication = reports.then(
    () => true,
    (error: unknown) => {
      console.error(error);
      return false;
    }
  );
  return new Promise<number>((resolve) => {
    child.on('error', () => {
      deadline.disarm();
      resolve(1);
    });
    child.on('close', async (code, signal) => {
      const published = await publication;
      deadline.disarm();
      resolve(
        gateExitCode({
          deadlineHit: deadline.deadlineHit(),
          signal,
          code,
          published,
        })
      );
    });
  });
}

if (import.meta.main) {
  await main();
}
