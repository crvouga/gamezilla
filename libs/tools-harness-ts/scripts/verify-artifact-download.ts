// @io-wall-ok — artifact transfer process adapter; signed URLs never reach logs.
import { spawn } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { ArtifactClient, FindOptions } from '@actions/artifact';
import artifact from '@actions/artifact';
import { consumeEvidence } from './verify-evidence-consume';
import { redactSecrets } from './verify-shard-stream';

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

export async function downloadEvidence(args: {
  readonly prefix: string;
  readonly directory: string;
  readonly findBy: ArtifactSource;
  readonly client: Pick<ArtifactClient, 'listArtifacts' | 'downloadArtifact'>;
  readonly consumer: {
    readonly consume: (directory: string) => Promise<void>;
    readonly release: (directory: string) => Promise<void>;
  };
}): Promise<void> {
  const { prefix, directory, findBy, client, consumer } = args;
  const listed = await client.listArtifacts({ latest: true, findBy });
  const selected = listed.artifacts.filter((item) =>
    item.name.startsWith(prefix)
  );
  if (!selected.length) throw new Error(`No ${prefix} evidence artifacts`);
  const failures: unknown[] = [];
  for (const item of selected) {
    try {
      await client.downloadArtifact(item.id, {
        path: directory,
        findBy,
      });
      await consumer.consume(directory);
    } catch (error) {
      failures.push(error);
    } finally {
      await consumer.release(directory);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'Evidence transfer failed');
  console.log(`Transferred ${selected.length} evidence artifacts`);
}

async function consumeTransfer(directory: string): Promise<void> {
  for (const name of readdirSync(directory).filter((name) =>
    /^(?:evidence|results)-\d+\.tar\.gz$/.test(name)
  ))
    await consumeEvidence(join(directory, name), process.argv[5]!);
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
    await downloadEvidence({
      prefix: process.argv[3]!,
      directory: process.argv[4]!,
      findBy: artifactSource(process.env),
      client: artifact,
      consumer: {
        consume: consumeTransfer,
        release: async (directory) => {
          rmSync(directory, { recursive: true, force: true });
        },
      },
    });
  else process.exit(await run());
}
