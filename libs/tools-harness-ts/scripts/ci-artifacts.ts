// @io-wall-ok — CI artifact entry: reads and deletes a run's GitHub Actions artifacts.
/**
 * CI jobs hand files to each other, and the nightly profile keeps its reports,
 * as GitHub Actions artifacts. The repository is public, so their storage is
 * free and outside the account quota that once stopped every Verify run (the
 * reason a paid R2 bucket briefly held them instead).
 *
 * Workflows upload with `actions/upload-artifact` (`overwrite: true`,
 * `include-hidden-files: true`, a retention of a day for transfers and a few
 * days for reports). This module is the read side: it lists, downloads and
 * deletes a run's artifacts through the REST API with `gh`, which carries the
 * job's `GH_TOKEN` (the job needs `actions: read`, and `actions: write` to
 * delete).
 *
 * A rerun can leave two artifacts of one name in a run; the newest (highest
 * ID) wins. Every listing is complete before anything is deleted, so a failed
 * page deletes nothing.
 *
 *   ci-artifacts.ts download <name> <directory>
 *   ci-artifacts.ts download-all <name prefix> <directory>   (one subdirectory per artifact)
 *   ci-artifacts.ts delete <name prefix>
 *
 * The run is `GITHUB_RUN_ID`, or `--run <id>` before the command. Locally,
 * `gh run download <run id> -p '<name prefix>*' -D <directory>` does the same.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

export interface RunArtifact {
  readonly id: number;
  readonly name: string;
  readonly expired: boolean;
}

/** The GitHub artifacts API, narrowed to what CI needs. */
export interface ArtifactsApi {
  /** Every artifact of the run, every page; throws rather than return part. */
  readonly list: (runId: string) => Promise<readonly RunArtifact[]>;
  /** Extracts the artifact's files under `directory`. */
  readonly download: (id: number, directory: string) => Promise<void>;
  readonly remove: (id: number) => Promise<void>;
}

function assertName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
    throw new Error(`Invalid artifact name: ${JSON.stringify(name)}`);
}

function assertRunId(runId: string): void {
  if (!/^[0-9]+$/.test(runId))
    throw new Error(`Invalid run ID: ${JSON.stringify(runId)}`);
}

/** The newest live artifact of each name that starts with `prefix`. */
async function newestByName(
  api: ArtifactsApi,
  runId: string,
  prefix: string
): Promise<Map<string, RunArtifact>> {
  assertRunId(runId);
  const newest = new Map<string, RunArtifact>();
  for (const artifact of await api.list(runId)) {
    if (artifact.expired || !artifact.name.startsWith(prefix)) continue;
    const seen = newest.get(artifact.name);
    if (!seen || artifact.id > seen.id) newest.set(artifact.name, artifact);
  }
  return newest;
}

function countFiles(directory: string): number {
  try {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
      .length;
  } catch {
    return 0;
  }
}

/** Writes the artifact's files under `directory`; false when the run has none of that name. */
export async function downloadArtifact(args: {
  readonly api: ArtifactsApi;
  readonly runId: string;
  readonly name: string;
  readonly directory: string;
}): Promise<boolean> {
  const { api, runId, name, directory } = args;
  assertName(name);
  const artifact = (await newestByName(api, runId, name)).get(name);
  if (!artifact) return false;
  mkdirSync(directory, { recursive: true });
  await api.download(artifact.id, directory);
  return true;
}

/** The names of this run's artifacts that start with `prefix`, sorted. */
export async function listArtifacts(args: {
  readonly api: ArtifactsApi;
  readonly runId: string;
  readonly prefix: string;
}): Promise<string[]> {
  const { api, runId, prefix } = args;
  return [...(await newestByName(api, runId, prefix)).keys()].sort();
}

/** Deletes every artifact of the run whose name starts with `prefix`, every attempt's. */
export async function deleteArtifacts(args: {
  readonly api: ArtifactsApi;
  readonly runId: string;
  readonly prefix: string;
}): Promise<number> {
  const { api, runId, prefix } = args;
  assertRunId(runId);
  const doomed = (await api.list(runId)).filter(
    (artifact) => !artifact.expired && artifact.name.startsWith(prefix)
  );
  for (const artifact of doomed) await api.remove(artifact.id);
  return doomed.length;
}

function gh(args: readonly string[]): Buffer {
  const result = spawnSync('gh', args, {
    env: process.env,
    maxBuffer: 1 << 30,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `gh ${args.slice(0, 2).join(' ')} failed: ${result.stderr.toString().trim()}`
    );
  return result.stdout;
}

/** `GITHUB_REPOSITORY` in CI, else `gh`'s own resolution of this checkout. */
function repository(env: Readonly<Record<string, string | undefined>>): string {
  return (
    env['GH_REPO']?.trim() ||
    env['GITHUB_REPOSITORY']?.trim() ||
    '{owner}/{repo}'
  );
}

export function githubArtifactsApi(
  env: Readonly<Record<string, string | undefined>> = process.env
): ArtifactsApi {
  const repo = repository(env);
  return {
    list: async (runId) => {
      assertRunId(runId);
      const out = gh([
        'api',
        '--paginate',
        `repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`,
        '--jq',
        '.artifacts[] | {id, name, expired}',
      ]).toString('utf8');
      return out
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as RunArtifact);
    },
    download: async (id, directory) => {
      const scratch = mkdtempSync(join(tmpdir(), 'ci-artifact-'));
      try {
        const zip = join(scratch, 'artifact.zip');
        writeFileSync(
          zip,
          gh(['api', `repos/${repo}/actions/artifacts/${String(id)}/zip`])
        );
        const unzip = spawnSync('unzip', ['-q', '-o', zip, '-d', directory], {
          stdio: 'inherit',
        });
        if (unzip.status !== 0)
          throw new Error(`unzip of artifact ${String(id)} failed`);
      } finally {
        removeTree(scratch, { whenLocked: 'leave' });
      }
    },
    remove: async (id) => {
      gh([
        'api',
        '--method',
        'DELETE',
        `repos/${repo}/actions/artifacts/${String(id)}`,
      ]);
    },
  };
}

async function main(argv: readonly string[]): Promise<void> {
  let args = [...argv];
  let runId = process.env['GITHUB_RUN_ID'] ?? '';
  if (args[0] === '--run') {
    runId = args[1] ?? '';
    args = args.slice(2);
  }
  const [command, target, ...rest] = args;
  const api = githubArtifactsApi();
  if (command === 'download' && target && rest.length === 1) {
    const directory = resolve(rest[0]!);
    if (!(await downloadArtifact({ api, runId, name: target, directory })))
      throw new Error(`No CI artifact ${target} in run ${runId}`);
    console.log(
      `Downloaded CI artifact ${target} (${countFiles(directory)} entries)`
    );
  } else if (command === 'download-all' && target && rest.length === 1) {
    const names = await listArtifacts({ api, runId, prefix: target });
    if (!names.length)
      throw new Error(`No ${target}* CI artifacts in run ${runId}`);
    for (const name of names)
      await downloadArtifact({
        api,
        runId,
        name,
        directory: join(resolve(rest[0]!), name),
      });
    console.log(`Downloaded ${names.length} CI artifacts: ${names.join(', ')}`);
  } else if (command === 'delete' && target && !rest.length) {
    const count = await deleteArtifacts({ api, runId, prefix: target });
    console.log(`Deleted ${count} ${target}* CI artifacts`);
  } else {
    throw new Error(
      'usage: ci-artifacts.ts [--run <id>] download <name> <dir> | download-all <prefix> <dir> | delete <prefix>'
    );
  }
}

if (import.meta.main) await main(process.argv.slice(2));
