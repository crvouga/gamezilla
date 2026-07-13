import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SECRETS_DEFAULTS } from './defaults';
import {
  readSecretsConfig,
  resolveSecretsConfigPath,
  resolveSecretsScope,
} from './infisical-json';

const ENV_NAMES = [
  'SECRETS_ADDR',
  'SECRETS_ENV',
  'SECRETS_PROJECT_ID',
] as const;

describe('infisical config', () => {
  let repoRoot: string;
  let previousEnv: Record<string, string | undefined>;

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

  it('resolves and reads a trimmed config file', () => {
    writeConfig({
      workspaceId: ' workspace-id ',
      defaultEnvironment: ' staging ',
      domain: ' https://secrets.example.com ',
    });

    expect(resolveSecretsConfigPath(repoRoot)).toBe(
      join(repoRoot, '.infisical.json')
    );
    expect(readSecretsConfig(repoRoot)).toEqual({
      workspaceId: 'workspace-id',
      defaultEnvironment: 'staging',
      domain: 'https://secrets.example.com',
    });
  });

  it('applies argument and environment overrides before file defaults', () => {
    writeConfig({
      workspaceId: 'file-project',
      defaultEnvironment: 'file-env',
      domain: 'https://file.example.com',
    });
    process.env['SECRETS_PROJECT_ID'] = ' env-project ';
    process.env['SECRETS_ENV'] = ' env-name ';
    process.env['SECRETS_ADDR'] = ' https://env.example.com ';

    expect(resolveSecretsScope(repoRoot, ' argument-env ')).toEqual({
      workspaceId: 'env-project',
      env: 'argument-env',
      domain: 'https://env.example.com',
    });
  });

  it('falls back to built-in environment and domain defaults', () => {
    writeConfig({ workspaceId: 'project-id' });

    expect(resolveSecretsScope(repoRoot)).toEqual({
      workspaceId: 'project-id',
      env: SECRETS_DEFAULTS.env,
      domain: SECRETS_DEFAULTS.domain,
    });
  });

  it('rejects non-object config and missing workspace ids', () => {
    writeFileSync(resolveSecretsConfigPath(repoRoot), '[]');
    expect(() => readSecretsConfig(repoRoot)).toThrow(
      '.infisical.json must be a JSON object'
    );

    writeConfig({ workspaceId: ' ' });
    expect(() => readSecretsConfig(repoRoot)).toThrow(
      '.infisical.json: workspaceId is required'
    );
  });

  it('rejects placeholder project ids from the file or environment', () => {
    writeConfig({ workspaceId: 'replace_me' });
    expect(() => resolveSecretsScope(repoRoot)).toThrow(
      '.infisical.json workspaceId is still "replace_me"'
    );

    writeConfig({ workspaceId: 'valid-project' });
    process.env['SECRETS_PROJECT_ID'] = 'TODO';
    expect(() => resolveSecretsScope(repoRoot)).toThrow(
      '.infisical.json workspaceId is still "TODO"'
    );
  });

  function writeConfig(config: Record<string, unknown>): void {
    writeFileSync(
      resolveSecretsConfigPath(repoRoot),
      JSON.stringify(config),
      'utf8'
    );
  }
});
