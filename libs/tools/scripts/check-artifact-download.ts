// @io-wall-ok — artifact transfer process adapter; signed URLs never reach logs.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ArtifactClient, FindOptions } from '@actions/artifact';
import artifact from '@actions/artifact';
import { redactSecrets } from './check-shard-stream';

export function transferDiagnostic(line: string): string {
  return line.replace(/https?:\/\/[^\s"'<>]+/g, '[transfer-url-redacted]');
}

type ArtifactSource = NonNullable<FindOptions['findBy']>;

/** Shell steps use the workflow token; action-only runtime tokens are absent. */
export function artifactSource(
  env: Readonly<Record<string, string | undefined>>
): ArtifactSource {
  const token = (env['GH_TOKEN'] ?? env['GITHUB_TOKEN'] ?? '').trim();
  const repository = (env['GITHUB_REPOSITORY'] ?? '').split('/');
  const workflowRunId = Number(env['GITHUB_RUN_ID']);
  if (
    !token ||
    repository.length !== 2 ||
    repository.some((part) => !part) ||
    !Number.isSafeInteger(workflowRunId) ||
    workflowRunId <= 0
  )
    throw new Error(
      'Artifact transfer requires a workflow token, GITHUB_REPOSITORY and GITHUB_RUN_ID'
    );
  return {
    token,
    workflowRunId,
    repositoryOwner: repository[0]!,
    repositoryName: repository[1]!,
  };
}

export async function downloadEvidence(
  prefix: string,
  directory: string,
  findBy: ArtifactSource,
  client: Pick<ArtifactClient, 'listArtifacts' | 'downloadArtifact'>
): Promise<void> {
  const listed = await client.listArtifacts({ latest: true, findBy });
  const selected = listed.artifacts.filter((item) =>
    item.name.startsWith(prefix)
  );
  if (!selected.length) throw new Error(`No ${prefix} evidence artifacts`);
  let next = 0;
  async function worker(): Promise<void> {
    for (let index = next++; index < selected.length; index = next++)
      await client.downloadArtifact(selected[index]!.id, {
        path: directory,
        findBy,
      });
  }
  await Promise.all(
    Array.from({ length: Math.min(8, selected.length) }, worker)
  );
  console.log(`Transferred ${selected.length} evidence artifacts`);
}

async function run(): Promise<number> {
  const child = spawn(
    process.execPath,
    [import.meta.filename, '--worker', ...process.argv.slice(2)],
    {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const log = (line: string) =>
    console.log(redactSecrets(transferDiagnostic(line), process.env));
  createInterface({ input: child.stdout! }).on('line', log);
  createInterface({ input: child.stderr! }).on('line', log);
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (status) => resolve(status ?? 1));
  });
}

if (import.meta.main) {
  if (process.argv[2] === '--worker')
    await downloadEvidence(
      process.argv[3]!,
      process.argv[4]!,
      artifactSource(process.env),
      artifact
    );
  else process.exit(await run());
}
