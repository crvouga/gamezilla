// @io-wall-ok — artifact transfer process adapter; signed URLs never reach logs.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import {
  ciArtifactsStore,
  downloadArtifact,
  listArtifacts,
} from './ci-artifacts';
import { consumeEvidence } from './verify-evidence-consume';
import { redactSecrets } from './verify-shard-stream';

export function transferDiagnostic(line: string): string {
  return line.replace(/https?:\/\/[^\s"'<>]+/g, '[transfer-url-redacted]');
}

/** Transfers read this run's CI artifacts; nothing else scopes them. */
export function transferRunId(
  env: Readonly<Record<string, string | undefined>>
): string {
  const runId = (env['GITHUB_RUN_ID'] ?? '').trim();
  if (!/^[1-9][0-9]*$/.test(runId))
    throw new Error('Artifact transfer requires GITHUB_RUN_ID');
  return runId;
}

/**
 * Downloads, consumes and releases one artifact at a time, so the runner's
 * disk holds a single shard's evidence however many shards ran.
 */
export async function downloadEvidence(args: {
  readonly prefix: string;
  readonly directory: string;
  readonly runId: string;
  readonly store: ObjectStore;
  readonly consumer: {
    readonly consume: (directory: string) => Promise<void>;
    readonly release: (directory: string) => Promise<void>;
  };
}): Promise<void> {
  const { prefix, directory, runId, store, consumer } = args;
  const names = await listArtifacts({ store, runId, prefix });
  if (!names.length) throw new Error(`No ${prefix} evidence artifacts`);
  const failures: unknown[] = [];
  for (const name of names) {
    try {
      await downloadArtifact({ store, runId, name, directory });
      await consumer.consume(directory);
    } catch (error) {
      failures.push(error);
    } finally {
      await consumer.release(directory);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'Evidence transfer failed');
  console.log(`Transferred ${names.length} evidence artifacts`);
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
      runId: transferRunId(process.env),
      store: ciArtifactsStore(process.env),
      consumer: {
        consume: consumeTransfer,
        release: async (directory) => {
          removeTree(directory, { whenLocked: 'leave' });
        },
      },
    });
  else process.exit(await run());
}
