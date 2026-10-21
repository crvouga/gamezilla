import { expect, test } from 'bun:test';
import { spawnOwned } from '@pkgs/os-server-ts/dev-owner-spawn';

// regression: worker-cron-cold-outbox-registry
test('a cold cron invocation composes consumers and releases each database session', async () => {
  const child = spawnOwned(
    process.execPath,
    [
      '--no-env-file',
      new URL('./worker-cron-bootstrap.fixture.ts', import.meta.url).pathname,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => {
    stdout += String(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  expect(code, stderr).toBe(0);
  const messages = stderr
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  expect(messages).toEqual([
    expect.objectContaining({
      level: 'warn',
      msg: 'no billing provider configured; billing routes will return 503',
    }),
  ]);
  const lastLine = stdout.trim().split('\n').at(-1) ?? '';
  expect(JSON.parse(lastLine)).toEqual({
    composed: 1,
    queried: true,
    closed: 2,
  });
});
