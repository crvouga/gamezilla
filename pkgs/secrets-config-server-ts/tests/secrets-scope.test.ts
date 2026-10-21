import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import {
  readSecretsConfig,
  resolveSecretsConfigPath,
  resolveSecretsScope,
} from '@pkgs/secrets-config-server-ts/secrets-scope';
import { SECRETS_DEFAULTS } from '@pkgs/secrets-config-shared-ts/defaults';

const ENV_NAMES = [
  'SECRETS_ADDR',
  'SECRETS_ENV',
  'SECRETS_PROJECT_ID',
] as const;

describe('secrets scope config', () => {
  let repoRoot: string;
  let previousEnv: Record<string, string | undefined>;
  const fs = wallNodeFs();

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'secrets-config-'));
    previousEnv = Object.fromEntries(
      ENV_NAMES.map((name) => [name, process.env[name]])
    );
    for (const name of ENV_NAMES) delete process.env[name];
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    for (const name of ENV_NAMES) {
      const value = previousEnv[name];
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  function configStore() {
    return createNodeFsObjectStore({ rootDir: repoRoot, fs, layout: 'tree' });
  }

  it('resolves and reads a trimmed config file', async () => {
    writeConfig({
      projectId: ' project-id ',
      environment: ' staging ',
      endpoint: ' https://secrets.example.com ',
    });

    expect(resolveSecretsConfigPath(repoRoot)).toBe(
      join(repoRoot, '.secrets.json')
    );
    await expect(readSecretsConfig(configStore())).resolves.toEqual({
      projectId: 'project-id',
      environment: 'staging',
      endpoint: 'https://secrets.example.com',
    });
  });

  it('applies argument and environment overrides before file defaults', async () => {
    writeConfig({
      projectId: 'file-project',
      environment: 'file-env',
      endpoint: 'https://file.example.com',
    });
    process.env['SECRETS_PROJECT_ID'] = ' env-project ';
    process.env['SECRETS_ENV'] = ' env-name ';
    process.env['SECRETS_ADDR'] = ' https://env.example.com ';

    await expect(
      resolveSecretsScope(configStore(), ' argument-env ')
    ).resolves.toEqual({
      projectId: 'env-project',
      env: 'argument-env',
      endpoint: 'https://env.example.com',
    });
  });

  it('falls back to built-in environment default and null endpoint', async () => {
    writeConfig({ projectId: 'project-id' });

    await expect(resolveSecretsScope(configStore())).resolves.toEqual({
      projectId: 'project-id',
      env: SECRETS_DEFAULTS.env,
      endpoint: null,
    });
  });

  it('rejects non-object config and missing project ids', async () => {
    writeFileSync(resolveSecretsConfigPath(repoRoot), '[]');
    await expect(readSecretsConfig(configStore())).rejects.toThrow(
      '.secrets.json must be a JSON object'
    );

    writeConfig({ projectId: ' ' });
    await expect(readSecretsConfig(configStore())).rejects.toThrow(
      '.secrets.json: projectId is required'
    );
  });

  it('rejects placeholder project ids from the file or environment', async () => {
    writeConfig({ projectId: 'replace_me' });
    await expect(resolveSecretsScope(configStore())).rejects.toThrow(
      '.secrets.json projectId is still "replace_me"'
    );

    writeConfig({ projectId: 'valid-project' });
    process.env['SECRETS_PROJECT_ID'] = 'TODO';
    await expect(resolveSecretsScope(configStore())).rejects.toThrow(
      '.secrets.json projectId is still "TODO"'
    );
  });

  it('ignores a non-UUID SECRETS_PROJECT_ID slug when the file has a UUID', async () => {
    const fileUuid = '26137c60-8dea-4d95-a8a3-30901615b026';
    writeConfig({ projectId: fileUuid, environment: 'dev' });
    process.env['SECRETS_PROJECT_ID'] = 'secrets';

    await expect(resolveSecretsScope(configStore())).resolves.toEqual({
      projectId: fileUuid,
      env: 'dev',
      endpoint: null,
    });
  });

  it('lets a UUID SECRETS_PROJECT_ID override the file UUID', async () => {
    writeConfig({
      projectId: '26137c60-8dea-4d95-a8a3-30901615b026',
      environment: 'dev',
    });
    process.env['SECRETS_PROJECT_ID'] = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    await expect(resolveSecretsScope(configStore())).resolves.toMatchObject({
      projectId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });
  });

  function writeConfig(config: Record<string, unknown>): void {
    writeFileSync(
      resolveSecretsConfigPath(repoRoot),
      JSON.stringify(config),
      'utf8'
    );
  }
});
