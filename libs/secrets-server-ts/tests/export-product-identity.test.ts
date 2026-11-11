import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syntheticIdentity } from '@libs/product-brand-shared-ts/synthetic-identity';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const SCRIPT = join(
  import.meta.dirname,
  '../scripts/export-product-identity.ts'
);

function exported(mode: 'fixture' | 'configured'): Map<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'export-identity-'));
  const githubEnv = join(dir, 'github-env');
  try {
    const run = Bun.spawnSync(['bun', 'run', SCRIPT], {
      env: {
        PATH: process.env['PATH'] ?? '',
        HOME: process.env['HOME'] ?? '',
        GITHUB_ENV: githubEnv,
        PRODUCT_IDENTITY_MODE: mode,
        REPOSITORY_IDENTITY_JSON: JSON.stringify(syntheticIdentity()),
      },
    });
    expect(run.exitCode).toBe(0);
    const lines = readFileSync(githubEnv, 'utf8').trim().split('\n');
    return new Map(
      lines.map((line) => [
        line.slice(0, line.indexOf('=')),
        line.slice(line.indexOf('=') + 1),
      ])
    );
  } finally {
    removeTree(dir, { whenLocked: 'leave' });
  }
}

// regression: fixture-job-materializes-configured-identity
test('a fixture job keeps the fixture identity in every later step', () => {
  const env = exported('fixture');
  expect(env.has('PRODUCT_IDENTITY_JSON')).toBe(true);
  expect(env.get('PRODUCT_IDENTITY_MODE')).toBe('fixture');
});

test('a configured job exports the configured identity and says so', () => {
  expect(exported('configured').get('PRODUCT_IDENTITY_MODE')).toBe(
    'configured'
  );
});
