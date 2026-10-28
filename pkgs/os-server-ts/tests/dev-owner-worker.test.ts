import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnOwned } from '@pkgs/os-server-ts/dev-owner-spawn';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';

// regression: dev-owner-worker-temp-collision
test('concurrent Node worker registrations publish one complete owner record', async () => {
  const root = mkdtempSync(join(tmpdir(), 'owner-worker-'));
  const child = spawnOwned(
    'node',
    [join(import.meta.dirname, 'dev-owner-worker-fixture.cjs')],
    {
      env: {
        ...process.env,
        DEV_OWNER_ROOT: root,
        DEV_OWNER_BOOT: 'worker-collision',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    }
  );
  let errors = '';
  child.stderr?.on('data', (chunk) => {
    errors += String(chunk);
  });
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    expect(errors).toBe('');
    expect(code).toBe(0);
    const record = JSON.parse(
      readFileSync(join(root, `.cache/dev-owner/pid-${child.pid}.json`), 'utf8')
    );
    expect(record).toMatchObject({ pid: child.pid, boot: 'worker-collision' });
  } finally {
    child.kill('SIGKILL');
    removeTree(root, { whenLocked: 'leave' });
  }
});
