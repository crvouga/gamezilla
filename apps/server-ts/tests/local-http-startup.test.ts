import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnOwned } from '@pkgs/dev-owner-server-ts/dev-owner-spawn';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

// regression: local-auth-http-scope-cross-talk
// regression: server-startup-fixture-encoded-path
test('cold server bootstrap isolates overlapping local HTTP invocations', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'server startup path '));
  const fixture = pathToFileURL(join(directory, 'startup fixture.ts'));
  writeFileSync(
    fixture,
    `await import(${JSON.stringify(new URL('./local-http-startup.fixture.ts', import.meta.url).href)});`
  );
  try {
    const child = spawnOwned(
      process.execPath,
      ['--no-env-file', fileURLToPath(fixture)],
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
  } finally {
    removeTree(directory, { whenLocked: 'leave' });
  }
}, 60_000);
