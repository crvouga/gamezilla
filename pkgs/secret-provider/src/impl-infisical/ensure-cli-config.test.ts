import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import { ensureInfisicalCliConfig } from './ensure-cli-config';

describe('ensureInfisicalCliConfig', () => {
  let repoRoot: string;
  let previousSecretsEnv: string | undefined;
  const fs = wallNodeFs();

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    if (previousSecretsEnv === undefined) delete process.env['SECRETS_ENV'];
    else process.env['SECRETS_ENV'] = previousSecretsEnv;
  });

  function configStore() {
    return createNodeFsObjectStore({ rootDir: repoRoot, fs, layout: 'tree' });
  }

  it('pins defaultEnvironment to .secrets.json, not SECRETS_ENV', async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'ensure-cli-config-'));
    writeFileSync(
      join(repoRoot, '.secrets.json'),
      JSON.stringify({
        projectId: '26137c60-8dea-4d95-a8a3-30901615b026',
        environment: 'dev',
      })
    );
    previousSecretsEnv = process.env['SECRETS_ENV'];
    process.env['SECRETS_ENV'] = 'prd';

    await ensureInfisicalCliConfig(configStore(), {
      projectId: '26137c60-8dea-4d95-a8a3-30901615b026',
      env: 'prd',
      endpoint: null,
    });

    const written = JSON.parse(
      readFileSync(join(repoRoot, '.infisical.json'), 'utf8')
    ) as { defaultEnvironment: string; workspaceId: string };
    expect(written.defaultEnvironment).toBe('dev');
    expect(written.workspaceId).toBe('26137c60-8dea-4d95-a8a3-30901615b026');
  });

  it('does not rewrite when content is already correct', async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'ensure-cli-config-'));
    writeFileSync(
      join(repoRoot, '.secrets.json'),
      JSON.stringify({
        projectId: '26137c60-8dea-4d95-a8a3-30901615b026',
        environment: 'dev',
      })
    );
    previousSecretsEnv = process.env['SECRETS_ENV'];

    const scope = {
      projectId: '26137c60-8dea-4d95-a8a3-30901615b026',
      env: 'dev',
      endpoint: null,
    } as const;
    await ensureInfisicalCliConfig(configStore(), scope);
    const path = join(repoRoot, '.infisical.json');
    const first = readFileSync(path, 'utf8');

    process.env['SECRETS_ENV'] = 'prd';
    await ensureInfisicalCliConfig(configStore(), { ...scope, env: 'prd' });
    expect(readFileSync(path, 'utf8')).toBe(first);
  });
});
