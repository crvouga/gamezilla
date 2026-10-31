/**
 * Ask turbo what a run would do before paying for it.
 *
 * `turbo run --dry=json` hashes every task and asks the cache whether that
 * hash exists. Turbo only caches a task that succeeded, so a HIT is that
 * task's green verdict for exactly these inputs. The dry run asks the *local*
 * cache only (~4s): with `remote:` in `--cache` turbo also asks the remote
 * about every task one request at a time, ~70s for the whole gate even when
 * every task is a local hit. The remote is then asked only about the local
 * misses, in parallel (`HEAD /v8/artifacts/<hash>`, `resolveRemoteHits`).
 * Two things follow:
 *
 * - **Nothing to execute → nothing to run.** When every task is a HIT the gate
 *   has already passed; replaying ~400 cache restores would only re-print it.
 * - **Otherwise run only the misses.** `turbo run <pkg#task…>` schedules the
 *   named tasks plus their `dependsOn` closure, with the same hashes the full
 *   run computes (a task's hash is its inputs plus its dependencies' hashes —
 *   dependents and siblings do not enter it), so results land under the keys
 *   the next dry run looks up. The hits outside that closure already carry
 *   their verdict; restoring them would change nothing. (`--only` would also
 *   skip them, but it drops dependencies from the hash — wrong cache keys.)
 * - **Restore the closure's hits locally.** Turbo's `--concurrency` also caps
 *   cache restores, and a remote restore is a cross-country round trip, so on
 *   a 2-core runner ~400 remote hits cost ~40s before any real work finished.
 *   The remote artifact is byte-for-byte turbo's local `<hash>.tar.zst`, so
 *   fetching them in parallel into the local cache first turns every hit into
 *   a local restore. A prefetch that fails just leaves turbo to fetch that
 *   hash itself — never a different verdict.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { captureTurboDryRun } from './turbo-dry-run';
import {
  type DryRunTask,
  projectTurboDryRun,
  type TurboDryRun,
} from './turbo-dry-run-projection';
import { verifyCacheConcurrency } from './verify-cache-concurrency';

/** Task with a real script; `<NONEXISTENT>` placeholders are dropped. */
export type PlannedTask = {
  readonly taskId: string;
  readonly hash: string;
  readonly hit: boolean;
  /** Where the HIT lives; `null` for a MISS. */
  readonly source: 'LOCAL' | 'REMOTE' | null;
  /** Live-data verifications must execute even when an old artifact exists. */
  readonly cacheable?: boolean;
  /** Direct `dependsOn` task ids (placeholders included). */
  readonly dependencies: readonly string[];
};

export type RunPlan = {
  readonly tasks: readonly PlannedTask[];
  /** Tasks turbo will execute (cache MISS). */
  readonly toExecute: readonly PlannedTask[];
  /**
   * HITs inside the misses' dependency closure that only the remote cache
   * has — what running the misses will restore, so worth prefetching.
   */
  readonly remoteHits: readonly PlannedTask[];
};

const NONEXISTENT = '<NONEXISTENT>';

function toPlannedTask(task: DryRunTask): PlannedTask | null {
  if (task.command === NONEXISTENT) return null;
  if (typeof task.taskId !== 'string' || typeof task.hash !== 'string') {
    throw new Error('turbo --dry=json: task without taskId/hash');
  }
  const cacheable = task.resolvedTaskDefinition?.cache !== false;
  const hit = cacheable && task.cache?.status === 'HIT';
  const source = task.cache?.source;
  return {
    taskId: task.taskId,
    hash: task.hash,
    hit,
    source: hit && (source === 'LOCAL' || source === 'REMOTE') ? source : null,
    cacheable,
    dependencies: Array.isArray(task.dependencies)
      ? task.dependencies.filter(
          (dep): dep is string => typeof dep === 'string'
        )
      : [],
  };
}

/** Every real task the misses depend on, transitively (misses excluded). */
function dependencyClosure(
  misses: readonly PlannedTask[],
  byId: ReadonlyMap<string, PlannedTask>
): PlannedTask[] {
  const seen = new Set(misses.map((task) => task.taskId));
  const out: PlannedTask[] = [];
  const stack = misses.flatMap((task) => task.dependencies);
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const task = byId.get(id);
    if (task === undefined) continue;
    out.push(task);
    stack.push(...task.dependencies);
  }
  return out;
}

/** Parse `turbo run --dry=json` stdout into a plan. */
export function planFromDryRun(json: string | TurboDryRun): RunPlan {
  const parsed = typeof json === 'string' ? projectTurboDryRun([json]) : json;
  if (!Array.isArray(parsed.tasks)) {
    throw new Error('turbo --dry=json: missing tasks array');
  }
  return planFromTasks(
    (parsed.tasks as DryRunTask[])
      .map(toPlannedTask)
      .filter((task): task is PlannedTask => task !== null)
  );
}

function planFromTasks(tasks: readonly PlannedTask[]): RunPlan {
  const toExecute = tasks.filter((task) => !task.hit);
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  return {
    tasks,
    toExecute,
    remoteHits: dependencyClosure(toExecute, byId).filter(
      (task) => task.hit && task.source === 'REMOTE'
    ),
  };
}

/** Cached report tasks run only when their published content is absent. */
export function restoreSelectedReports(
  plan: RunPlan,
  taskIds: readonly string[]
): RunPlan {
  const selected = new Set(taskIds);
  const roots = plan.tasks.filter(
    (task) => !task.hit || selected.has(task.taskId)
  );
  const byId = new Map(plan.tasks.map((task) => [task.taskId, task]));
  const needed = [...roots, ...dependencyClosure(roots, byId)];
  return {
    tasks: plan.tasks,
    toExecute: roots,
    remoteHits: needed.filter((task) => task.hit && task.source === 'REMOTE'),
  };
}

/**
 * The plan for a run that must leave every task's outputs on disk
 * (`turbo-ci-run --restore-outputs`): every hit only the remote holds is
 * prefetched, not just the ones the misses depend on, so turbo restores them
 * all from the local cache instead of looking each up remotely in series.
 */
export function restoreEveryHit(plan: RunPlan): RunPlan {
  return {
    ...plan,
    remoteHits: plan.tasks.filter(
      (task) => task.hit && task.source === 'REMOTE'
    ),
  };
}

/**
 * The `local:` part of a `--cache` flag (what the dry run asks), or `null`
 * when the local cache is off and the dry run must ask the remote itself.
 */
export function localCacheFlag(cache: string): string | null {
  const local = cache.split(',').find((part) => part.startsWith('local:'));
  return local === undefined || local === 'local:' ? null : local;
}

/** Whether a `--cache` flag reads the remote cache. */
export function readsRemoteCache(cache: string): boolean {
  return cache
    .split(',')
    .some(
      (part) =>
        part.startsWith('remote:') && part.slice('remote:'.length).includes('r')
    );
}

/**
 * Ask the remote about each of the local plan's misses, in parallel; a hash
 * the remote has is a REMOTE hit, as turbo's own remote lookup would report.
 * A lookup that fails counts as a miss: the task just runs.
 */
export async function resolveRemoteHits(
  plan: RunPlan,
  remoteHas: (hash: string) => Promise<boolean>,
  concurrency: number
): Promise<RunPlan> {
  const misses = plan.toExecute;
  const found = new Set<string>();
  let next = 0;
  async function worker(): Promise<void> {
    while (next < misses.length) {
      const task = misses[next] as PlannedTask;
      next += 1;
      if (task.cacheable === false) continue;
      const has = await remoteHas(task.hash).catch(() => false);
      if (has) found.add(task.taskId);
    }
  }
  const workers = Math.max(1, Math.min(concurrency, misses.length));
  await Promise.all(Array.from({ length: workers }, worker));
  if (found.size === 0) return plan;
  return planFromTasks(
    plan.tasks.map((task) =>
      found.has(task.taskId)
        ? { ...task, hit: true, source: 'REMOTE' as const }
        : task
    )
  );
}

/** Remote cache artifact URL, as turbo addresses it (`slug` unless `team_…`). */
export function artifactUrl(api: string, team: string, hash: string): string {
  const param = team.startsWith('team_') ? 'teamId' : 'slug';
  return `${api.replace(/\/+$/, '')}/v8/artifacts/${hash}?${param}=${encodeURIComponent(team)}`;
}

const REMOTE_LOOKUP_TIMEOUT_MS = 10_000;
const RATE_LIMIT_ATTEMPTS = 6;
const RATE_LIMIT_MAX_WAIT_MS = 8_000;

/**
 * The Vercel Remote Cache answers a burst of lookups with 429. A 429 is not
 * a miss: counting it as one reruns work the cache holds (Verify run
 * 40593008661 read 685 of ~1000 lookups as misses). Retry it after the
 * server's `Retry-After`, else an exponential backoff, a bounded number of
 * times; the last response is returned whatever it is.
 */
export async function retryRateLimited(
  request: () => Promise<Response>,
  sleep: (ms: number) => Promise<unknown> = Bun.sleep,
  attempts: number = RATE_LIMIT_ATTEMPTS
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await request();
    if (res.status !== 429 || attempt >= attempts) return res;
    const after = Number(res.headers.get('retry-after'));
    const wait =
      Number.isFinite(after) && after > 0
        ? after * 1000
        : 250 * 2 ** (attempt - 1);
    await sleep(Math.min(wait, RATE_LIMIT_MAX_WAIT_MS));
  }
}

/** Wall `HEAD` against the Vercel Remote Cache: does it hold `hash`? */
export function wallRemoteHas(
  env: NodeJS.ProcessEnv,
  observe?: (status: number, hash: string) => void
): (hash: string) => Promise<boolean> {
  const api = env['TURBO_API'] ?? '';
  const team = env['TURBO_TEAM'] ?? '';
  const token = env['TURBO_TOKEN'] ?? '';
  return async (hash) => {
    const res = await retryRateLimited(() =>
      fetch(artifactUrl(api, team, hash), {
        method: 'HEAD',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REMOTE_LOOKUP_TIMEOUT_MS),
      })
    ).catch((error: unknown) => {
      observe?.(0, hash);
      throw error;
    });
    observe?.(res.status, hash);
    return res.ok;
  };
}

export const REMOTE_LOOKUP_CONCURRENCY = 32;

export type PrefetchIo = {
  /** Artifact bytes, or `null` when the remote does not have it. */
  readonly fetchArtifact: (hash: string) => Promise<Uint8Array | null>;
  readonly exists: (path: string) => boolean;
  readonly writeFile: (path: string, data: Uint8Array | string) => void;
};

export type PrefetchResult = {
  readonly fetched: number;
  readonly failed: number;
};

/**
 * Download each hash into turbo's local cache layout
 * (`<hash>.tar.zst` + `<hash>-meta.json`). Meta is written last, so a
 * half-written artifact is never announced. Failures are counted, not thrown.
 */
export async function prefetchArtifacts(
  hashes: readonly string[],
  cacheDir: string,
  io: PrefetchIo,
  concurrency: number
): Promise<PrefetchResult> {
  const unique = [...new Set(hashes)];
  let next = 0;
  let fetched = 0;
  let failed = 0;
  async function worker(): Promise<void> {
    while (next < unique.length) {
      const hash = unique[next] as string;
      next += 1;
      const ok = await prefetchOne(hash, cacheDir, io);
      if (ok) fetched += 1;
      else failed += 1;
    }
  }
  const workers = Math.max(1, Math.min(concurrency, unique.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return { fetched, failed };
}

async function prefetchOne(
  hash: string,
  cacheDir: string,
  io: PrefetchIo
): Promise<boolean> {
  const tarPath = join(cacheDir, `${hash}.tar.zst`);
  const metaPath = join(cacheDir, `${hash}-meta.json`);
  if (io.exists(tarPath) && io.exists(metaPath)) return true;
  try {
    const bytes = await io.fetchArtifact(hash);
    if (bytes === null) return false;
    io.writeFile(tarPath, bytes);
    io.writeFile(metaPath, JSON.stringify({ hash, duration: 0 }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Turbo's local cache directory. `TURBO_CACHE_DIR` when set; otherwise turbo
 * keeps one cache per repository beside the *main* worktree's `.git` (so every
 * linked worktree shares it). A wrong guess only costs the prefetch.
 */
export function resolveTurboCacheDir(
  repoRoot: string,
  env: NodeJS.ProcessEnv
): string {
  const fromEnv = env['TURBO_CACHE_DIR']?.trim() ?? '';
  if (fromEnv !== '') return resolve(repoRoot, fromEnv);
  const commonDir = execFileSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd: repoRoot, encoding: 'utf8' }
  ).trim();
  return join(dirname(commonDir), '.turbo', 'cache');
}

/** `turbo run … --dry=json` with the real run's task args and cache flag. */
export function dryRunPlan(
  turboArgs: readonly string[],
  repoRoot: string,
  env: NodeJS.ProcessEnv
): RunPlan {
  return planFromDryRun(captureTurboDryRun(turboArgs, repoRoot, env));
}

const PREFETCH_CONCURRENCY = 32;
const PREFETCH_TIMEOUT_MS = 30_000;

/** Wall I/O for `prefetchArtifacts` against the Vercel Remote Cache. */
export function wallPrefetchIo(
  env: NodeJS.ProcessEnv,
  cacheDir: string
): PrefetchIo {
  const api = env['TURBO_API'] ?? '';
  const team = env['TURBO_TEAM'] ?? '';
  const token = env['TURBO_TOKEN'] ?? '';
  mkdirSync(cacheDir, { recursive: true });
  return {
    fetchArtifact: async (hash) => {
      const res = await retryRateLimited(() =>
        fetch(artifactUrl(api, team, hash), {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(PREFETCH_TIMEOUT_MS),
        })
      );
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    },
    exists: existsSync,
    writeFile: (path, data) => writeFileSync(path, data),
  };
}

export async function prefetchRemoteHits(
  plan: RunPlan,
  repoRoot: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  if (plan.remoteHits.length === 0) return;
  const cacheDir = resolveTurboCacheDir(repoRoot, env);
  const result = await prefetchArtifacts(
    plan.remoteHits.map((task) => task.hash),
    cacheDir,
    wallPrefetchIo(env, cacheDir),
    verifyCacheConcurrency(env, PREFETCH_CONCURRENCY)
  );
  console.log(
    `turbo-ci-run: prefetched ${String(result.fetched)} remote cache hit(s) into ${cacheDir}` +
      (result.failed > 0
        ? ` (${String(result.failed)} left for turbo to fetch)`
        : '')
  );
}
