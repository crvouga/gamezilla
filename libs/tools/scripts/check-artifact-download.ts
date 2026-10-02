// @io-wall-ok — artifact transfer process adapter; signed URLs never reach logs.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import artifact from '@actions/artifact';
import { redactSecrets } from './check-shard-stream';

export function transferDiagnostic(line: string): string {
  return line.replace(/https?:\/\/[^\s"'<>]+/g, '[transfer-url-redacted]');
}

async function download(prefix: string, directory: string): Promise<void> {
  const listed = await artifact.listArtifacts({ latest: true });
  const selected = listed.artifacts.filter((item) =>
    item.name.startsWith(prefix)
  );
  if (!selected.length) throw new Error(`No ${prefix} evidence artifacts`);
  let next = 0;
  async function worker(): Promise<void> {
    for (let index = next++; index < selected.length; index = next++)
      await artifact.downloadArtifact(selected[index]!.id, { path: directory });
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
    await download(process.argv[3]!, process.argv[4]!);
  else process.exit(await run());
}
