import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import { resolveInfisicalAccessTokenForWrites } from './oidc-access-token';

const ENV_KEYS = [
  'SECRETS_TOKEN',
  'INFISICAL_TOKEN',
  'INFISICAL_ACCESS_TOKEN',
  'SECRETS_IDENTITY_ID',
  'INFISICAL_IDENTITY_ID',
  'GITHUB_ACTIONS',
  'ACTIONS_ID_TOKEN_REQUEST_URL',
  'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
] as const;

describe('resolveInfisicalAccessTokenForWrites', () => {
  let repoRoot: string;
  let previous: Record<string, string | undefined>;
  const fs = wallNodeFs();

  function configStore() {
    return createNodeFsObjectStore({ rootDir: repoRoot, fs, layout: 'tree' });
  }

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('prefers SECRETS_TOKEN over provider-named token envs', async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'oidc-token-'));
    writeFileSync(
      join(repoRoot, '.secrets.json'),
      JSON.stringify({ projectId: 'project-1', environment: 'dev' })
    );
    previous = Object.fromEntries(
      ENV_KEYS.map((name) => [name, process.env[name]])
    );
    for (const key of ENV_KEYS) delete process.env[key];
    process.env['SECRETS_TOKEN'] = ' secrets-token ';
    process.env['INFISICAL_TOKEN'] = 'legacy-token';

    await expect(
      resolveInfisicalAccessTokenForWrites({
        repoRoot,
        configStore: configStore(),
      })
    ).resolves.toBe('secrets-token');
  });

  it('returns null outside GitHub Actions when no token is set', async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'oidc-token-'));
    writeFileSync(
      join(repoRoot, '.secrets.json'),
      JSON.stringify({ projectId: 'project-1', environment: 'dev' })
    );
    previous = Object.fromEntries(
      ENV_KEYS.map((name) => [name, process.env[name]])
    );
    for (const key of ENV_KEYS) delete process.env[key];

    await expect(
      resolveInfisicalAccessTokenForWrites({
        repoRoot,
        configStore: configStore(),
      })
    ).resolves.toBeNull();
  });
});
