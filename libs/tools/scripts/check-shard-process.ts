// @io-wall-ok — shard process entry adapter.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { redactSecrets, taskStream } from './check-shard-stream';
import type { CheckPlan } from './check-shards';

const ROOT = join(import.meta.dirname, '../../..');

export function executeShard(
  ids: readonly string[],
  env: NodeJS.ProcessEnv,
  tasks: CheckPlan['tasks']
): Promise<number> {
  const child = spawn(
    'turbo',
    [
      'run',
      ...ids,
      '--framework-inference=false',
      env['CHECK_CACHE_MODE'] === 'cold'
        ? '--cache=local:w,remote:w'
        : '--cache=local:rw,remote:rw',
      `--concurrency=${env['TURBO_CONCURRENCY'] ?? '16'}`,
      '--cache-workers=32',
      '--summarize',
      '--json',
      '--output-logs=full',
      '--continue=dependencies-successful',
    ],
    { cwd: ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const output = taskStream(tasks, (line) =>
    console.log(redactSecrets(line, env))
  );
  createInterface({ input: child.stdout! }).on('line', output);
  createInterface({ input: child.stderr! }).on('line', (line) =>
    console.error(redactSecrets(line, env))
  );
  const stop = () => {
    try {
      process.kill(-child.pid!, 'SIGTERM');
    } catch {}
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const timer = setTimeout(() => {
    console.error('Check shard deadline exceeded (1200s)');
    stop();
  }, 1_200_000);
  return new Promise((resolve) => {
    child.on('error', (error) => {
      console.error(error);
      resolve(1);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      resolve(code ?? 1);
    });
  });
}
