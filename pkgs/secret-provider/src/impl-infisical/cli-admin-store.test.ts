import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInfisicalCliAdminStore } from './cli-admin-store';

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

describe('createInfisicalCliAdminStore', () => {
  let repoRoot: string;
  let previous: Record<string, string | undefined>;

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('throws in GitHub Actions when no token or identity is available', async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'cli-admin-store-'));
    writeFileSync(
      join(repoRoot, '.secrets.json'),
      JSON.stringify({ projectId: 'project-1', environment: 'dev' })
    );
    previous = Object.fromEntries(
      ENV_KEYS.map((name) => [name, process.env[name]])
    );
    for (const key of ENV_KEYS) delete process.env[key];
    process.env['GITHUB_ACTIONS'] = 'true';

    await expect(createInfisicalCliAdminStore({ repoRoot })).rejects.toThrow(
      /SECRETS_IDENTITY_ID/
    );
  });

  it('accepts an explicit SECRETS_TOKEN outside of OIDC', async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'cli-admin-store-'));
    writeFileSync(
      join(repoRoot, '.secrets.json'),
      JSON.stringify({ projectId: 'project-1', environment: 'dev' })
    );
    previous = Object.fromEntries(
      ENV_KEYS.map((name) => [name, process.env[name]])
    );
    for (const key of ENV_KEYS) delete process.env[key];
    process.env['GITHUB_ACTIONS'] = 'true';
    process.env['SECRETS_TOKEN'] = 'explicit-token';

    const store = await createInfisicalCliAdminStore({ repoRoot });
    expect(store).toBeDefined();
    expect(process.env['INFISICAL_TOKEN']).toBe('explicit-token');
  });
});
