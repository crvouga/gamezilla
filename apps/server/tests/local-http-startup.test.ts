import { expect, test } from 'bun:test';
import { spawnOwned } from '@pkgs/os-server/dev-owner-spawn';

// regression: local-auth-http-scope-cross-talk
test('cold server bootstrap isolates overlapping local HTTP invocations', async () => {
  const child = spawnOwned(
    process.execPath,
    [
      '--no-env-file',
      new URL('./local-http-startup.fixture.ts', import.meta.url).pathname,
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
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(JSON.parse(stdout)).toEqual({
    token: 'https://provider.example/token',
    userinfo: 'https://provider.example/userinfo',
  });
});
