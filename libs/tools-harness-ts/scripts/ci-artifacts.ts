// @io-wall-ok — CI artifact entry: files between the workflow and the CI artifacts bucket.
/**
 * CI jobs hand files to each other, and the nightly profile keeps its reports,
 * in the CI artifacts bucket (fleet stack, `CI_ARTIFACTS_*`) instead of GitHub
 * Actions artifacts, whose account quota stopped every Verify run when it
 * filled. The bucket expires every object after a week.
 *
 * An artifact is every file under `<run id>/<name>/`, keyed by its path
 * relative to the deepest directory that holds every searched path, as
 * `actions/upload-artifact` does: one file uploads by its base name, the
 * patterns `apps/*` and `libs/*` keep their `apps/` and `libs/` prefixes.
 * Uploading a name again replaces it: the new files are written first, then
 * the keys the new upload no longer has are deleted, so no key is deleted and
 * rewritten at once (R2 allows one write a second to the same key).
 *
 * A write the bucket throttles (429) or fails (5xx) is retried after a pause:
 * both responses ask the client to back off and try again, and a whole-object
 * PUT is idempotent.
 *
 * `--best-effort` (before the command) marks an upload as diagnostic: when the
 * bucket cannot take it, the step warns and passes, because an outage of the
 * artifacts bucket must not fail the verification the files only describe.
 *
 *   ci-artifacts.ts [--best-effort] upload <name> <path or glob>...
 *   ci-artifacts.ts download <name> <directory>
 *   ci-artifacts.ts download-all <name prefix> <directory>   (one subdirectory per artifact)
 *   ci-artifacts.ts delete <name prefix>
 *
 * The run is `GITHUB_RUN_ID`, or `--run <id>` before the command.
 */
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server-ts/impl-s3';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

/** Bucket keys sit under this root; the run ID follows. */
export const CI_ARTIFACTS_ROOT = 'runs';

const CONCURRENCY = 16;
/** Pauses before each retried PUT; at least a second, R2's per-key write rate. */
export const PUT_RETRY_DELAYS_MS: readonly number[] = [1_000, 4_000];
const GLOB_CHARS = /[*?[\]{}]/;

export function ciArtifactsStore(
  env: Readonly<Record<string, string | undefined>>
): ObjectStore {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value)
      throw new Error(
        `${name} is not set: authenticate with secrets-auth in CI, or run under secrets-run`
      );
    return value;
  };
  return createS3ObjectStore({
    bucket: required('CI_ARTIFACTS_BUCKET'),
    endpoint: required('CI_ARTIFACTS_ENDPOINT'),
    region: required('CI_ARTIFACTS_REGION'),
    accessKeyId: required('CI_ARTIFACTS_ACCESS_KEY_ID'),
    secretAccessKey: required('CI_ARTIFACTS_SECRET_ACCESS_KEY'),
    rootPrefix: CI_ARTIFACTS_ROOT,
    http: createGlobalHttpClient(),
  });
}

function assertName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
    throw new Error(`Invalid artifact name: ${JSON.stringify(name)}`);
}

function assertRunId(runId: string): void {
  if (!/^[0-9]+$/.test(runId))
    throw new Error(`Invalid run ID: ${JSON.stringify(runId)}`);
}

function artifactPrefix(runId: string, name: string): string {
  assertRunId(runId);
  assertName(name);
  return `${runId}/${name}/`;
}

/** The directory a path or pattern searches: everything before its first wildcard. */
export function searchRoot(cwd: string, pattern: string): string {
  const segments = pattern.split(/[\\/]/);
  const literal: string[] = [];
  for (const segment of segments) {
    if (GLOB_CHARS.test(segment)) return resolve(cwd, ...literal);
    literal.push(segment);
  }
  const path = resolve(cwd, pattern);
  try {
    if (statSync(path).isDirectory()) return path;
  } catch {
    // A missing literal path still names its parent as the root.
  }
  return dirname(path);
}

export function commonRoot(paths: readonly string[]): string {
  const split = paths.map((path) => path.split(sep));
  const first = split[0] ?? [];
  let length = first.length;
  for (const parts of split.slice(1)) {
    let shared = 0;
    while (shared < length && parts[shared] === first[shared]) shared += 1;
    length = shared;
  }
  return first.slice(0, length).join(sep) || sep;
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Every file the paths and patterns match (hidden files included), and the root keys are relative to. */
export function collectFiles(
  cwd: string,
  patterns: readonly string[]
): { readonly root: string; readonly files: readonly string[] } {
  const files = new Set<string>();
  for (const pattern of patterns) {
    if (GLOB_CHARS.test(pattern)) {
      for (const match of new Bun.Glob(pattern).scanSync({
        cwd,
        dot: true,
        absolute: true,
        onlyFiles: true,
      }))
        files.add(resolve(match));
      continue;
    }
    const path = resolve(cwd, pattern);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (stats.isDirectory())
      for (const file of filesUnder(path)) files.add(file);
    else if (stats.isFile()) files.add(path);
  }
  return {
    root: commonRoot(patterns.map((pattern) => searchRoot(cwd, pattern))),
    files: [...files].sort(),
  };
}

async function eachLimited<T>(
  items: readonly T[],
  work: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const failures: unknown[] = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next]!;
        next += 1;
        try {
          await work(item);
        } catch (error) {
          failures.push(error);
        }
      }
    })
  );
  if (failures.length)
    throw new AggregateError(failures, 'CI artifact transfer failed');
}

function httpStatus(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object' || !('$metadata' in error))
    return undefined;
  const metadata = error.$metadata;
  if (
    metadata === null ||
    typeof metadata !== 'object' ||
    !('httpStatusCode' in metadata) ||
    typeof metadata.httpStatusCode !== 'number'
  )
    return undefined;
  return metadata.httpStatusCode;
}

/** The bucket throttled the write (429) or failed it (5xx) and asks for a retry. */
export function isRetryableWrite(error: unknown): boolean {
  const status = httpStatus(error);
  return status !== undefined && (status === 429 || status >= 500);
}

async function putWithBackoff(
  store: ObjectStore,
  key: string,
  bytes: Uint8Array,
  sleep: (ms: number) => Promise<void>
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await store.put(key, bytes, 'application/octet-stream');
      return;
    } catch (error) {
      const delay = PUT_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isRetryableWrite(error)) throw error;
      await sleep(delay);
    }
  }
}

export async function uploadArtifact(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly name: string;
  readonly root: string;
  readonly files: readonly string[];
  readonly sleep?: (ms: number) => Promise<void>;
}): Promise<number> {
  const { store, runId, name, root, files } = args;
  const sleep = args.sleep ?? ((ms: number) => Bun.sleep(ms));
  const prefix = artifactPrefix(runId, name);
  const keys = files.map((file) => {
    const key = slashPath(relative(root, file));
    if (!key || key.startsWith('../') || isAbsolute(key))
      throw new Error(`${file} is outside the artifact root ${root}`);
    return `${prefix}${key}`;
  });
  const previous = await store.listKeys(prefix);
  await eachLimited(
    files.map((file, index) => ({ file, key: keys[index]! })),
    ({ file, key }) => putWithBackoff(store, key, readFileSync(file), sleep)
  );
  // Only after every write: deleting a key and writing it again at once is
  // what R2 throttles, and a failed upload keeps the previous files.
  const current = new Set(keys);
  await store.deleteMany(previous.filter((key) => !current.has(key)));
  return files.length;
}

/** Writes the artifact's files under `directory`; returns how many there were. */
export async function downloadArtifact(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly name: string;
  readonly directory: string;
}): Promise<number> {
  const { store, runId, name, directory } = args;
  const prefix = artifactPrefix(runId, name);
  const keys = await store.listKeys(prefix);
  await eachLimited(keys, async (key) => {
    const object = await store.get(key);
    if (object === null) throw new Error(`CI artifact ${key} vanished`);
    const path = join(directory, ...key.slice(prefix.length).split('/'));
    mkdirSync(dirname(path), { recursive: true });
    await Bun.write(path, new Response(object.body));
  });
  return keys.length;
}

/** The names of this run's artifacts that start with `prefix`, sorted. */
export async function listArtifacts(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly prefix: string;
}): Promise<string[]> {
  const { store, runId, prefix } = args;
  assertRunId(runId);
  const run = `${runId}/`;
  const names = new Set<string>();
  for (const key of await store.listKeys(`${run}${prefix}`)) {
    const name = key.slice(run.length).split('/')[0];
    if (name) names.add(name);
  }
  return [...names].sort();
}

export async function deleteArtifacts(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly prefix: string;
}): Promise<number> {
  const { store, runId, prefix } = args;
  assertRunId(runId);
  const keys = await store.listKeys(`${runId}/${prefix}`);
  await store.deleteMany(keys);
  return keys.length;
}

async function main(argv: readonly string[]): Promise<void> {
  let args = [...argv];
  let runId = process.env['GITHUB_RUN_ID'] ?? '';
  let bestEffort = false;
  for (;;) {
    if (args[0] === '--run') {
      runId = args[1] ?? '';
      args = args.slice(2);
    } else if (args[0] === '--best-effort') {
      bestEffort = true;
      args = args.slice(1);
    } else break;
  }
  const [command, target, ...rest] = args;
  if (bestEffort && command !== 'upload')
    throw new Error('--best-effort applies only to upload');
  const store = ciArtifactsStore(process.env);
  if (command === 'upload' && target && rest.length) {
    const { root, files } = collectFiles(process.cwd(), rest);
    if (!files.length) {
      console.log(`No files for CI artifact ${target}; nothing uploaded.`);
      return;
    }
    try {
      const count = await uploadArtifact({
        store,
        runId,
        name: target,
        root,
        files,
      });
      console.log(`Uploaded ${count} files as CI artifact ${target}`);
    } catch (error) {
      if (!bestEffort) throw error;
      console.error(error);
      console.log(
        `::warning title=CI artifact not uploaded::${target} (${files.length} files) could not be uploaded to the CI artifacts bucket; this diagnostic upload does not decide the verification. ${String(error)}`
      );
    }
  } else if (command === 'download' && target && rest.length === 1) {
    const count = await downloadArtifact({
      store,
      runId,
      name: target,
      directory: resolve(rest[0]!),
    });
    if (!count) throw new Error(`No CI artifact ${target} in run ${runId}`);
    console.log(`Downloaded ${count} files of CI artifact ${target}`);
  } else if (command === 'download-all' && target && rest.length === 1) {
    const names = await listArtifacts({ store, runId, prefix: target });
    if (!names.length)
      throw new Error(`No ${target}* CI artifacts in run ${runId}`);
    for (const name of names)
      await downloadArtifact({
        store,
        runId,
        name,
        directory: join(resolve(rest[0]!), name),
      });
    console.log(`Downloaded ${names.length} CI artifacts: ${names.join(', ')}`);
  } else if (command === 'delete' && target && !rest.length) {
    const count = await deleteArtifacts({ store, runId, prefix: target });
    console.log(`Deleted ${count} objects of ${target}* CI artifacts`);
  } else {
    throw new Error(
      'usage: ci-artifacts.ts [--run <id>] [--best-effort] upload <name> <path>... | download <name> <dir> | download-all <prefix> <dir> | delete <prefix>'
    );
  }
}

if (import.meta.main) await main(process.argv.slice(2));
