import { expect, test } from 'bun:test';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnOwned } from '@pkgs/os-server/dev-owner-spawn';

// regression: dev-owner-restores-filtered-env
test('owned processes keep an explicit environment isolated from parent bindings', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'owner-env-')));
  const previous = process.env['DEV_OWNER_ENV_TEST_SECRET'];
  process.env['DEV_OWNER_ENV_TEST_SECRET'] = 'deployed-secret';
  try {
    const child = spawnOwned(
      process.execPath,
      [
        '--no-env-file',
        '-e',
        'console.log(JSON.stringify({ secret: process.env.DEV_OWNER_ENV_TEST_SECRET ?? null, root: process.env.DEV_OWNER_ROOT, boot: process.env.DEV_OWNER_BOOT }))',
      ],
      {
        env: {
          PATH: process.env['PATH'],
          DEV_OWNER_ROOT: root,
          DEV_OWNER_BOOT: 'isolated-env',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let output = '';
    child.stdout?.on('data', (chunk) => {
      output += String(chunk);
    });
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    expect(code).toBe(0);
    expect(JSON.parse(output)).toEqual({
      secret: null,
      root,
      boot: 'isolated-env',
    });
  } finally {
    if (previous === undefined) delete process.env['DEV_OWNER_ENV_TEST_SECRET'];
    else process.env['DEV_OWNER_ENV_TEST_SECRET'] = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
