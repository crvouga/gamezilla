import { spawnSync } from 'node:child_process';
import type { SecretAdminStore } from '@pkgs/secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config';
import { INFISICAL_CLI_BIN } from './defaults';
import { ensureInfisicalCliConfig } from './ensure-cli-config';
import { resolveInfisicalEndpoint } from './resolve-endpoint';
import { resolveInfisicalAccessTokenForWrites } from './oidc-access-token';

type SecretsCoords = {
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
};

export type CreateInfisicalCliAdminStoreOptions = {
  readonly repoRoot: string;
};

function resolveSecretsCoords(
  repoRoot: string,
  envOverride?: string
): SecretsCoords {
  const scope = resolveSecretsScope(repoRoot, envOverride);
  ensureInfisicalCliConfig(repoRoot, scope);
  return {
    workspaceId: scope.projectId,
    env: scope.env,
    domain: resolveInfisicalEndpoint(scope),
  };
}

function infisicalBaseArgs(coords: SecretsCoords): string[] {
  return [
    '--projectId',
    coords.workspaceId,
    '--env',
    coords.env,
    '--domain',
    coords.domain,
  ];
}

function infisicalEnv(): NodeJS.ProcessEnv {
  return { ...process.env, INFISICAL_DISABLE_MIGRATION_NOTICE: '1' };
}

function runInfisical(args: string[]): string {
  const result = spawnSync(INFISICAL_CLI_BIN, args, {
    encoding: 'utf8',
    env: infisicalEnv(),
  });
  if (result.error !== undefined) {
    throw new Error(
      `${INFISICAL_CLI_BIN} spawn failed: ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    throw new Error(
      `${INFISICAL_CLI_BIN} ${args.join(' ')} exited ${result.status}: ${stderr}`
    );
  }
  return (result.stdout ?? '').trim();
}

class InfisicalCliAdminStore implements SecretAdminStore {
  constructor(private readonly repoRoot: string) {}

  async fetchSecret(name: string, envOverride?: string): Promise<string> {
    const coords = resolveSecretsCoords(this.repoRoot, envOverride);
    return runInfisical([
      'secrets',
      'get',
      name,
      ...infisicalBaseArgs(coords),
      '--plain',
    ]);
  }

  async secretExists(name: string, envOverride?: string): Promise<boolean> {
    try {
      const value = await this.fetchSecret(name, envOverride);
      return value !== '';
    } catch {
      return false;
    }
  }

  async setSecret(
    name: string,
    value: string,
    envOverride?: string
  ): Promise<void> {
    const coords = resolveSecretsCoords(this.repoRoot, envOverride);
    runInfisical([
      'secrets',
      'set',
      `${name}=${value}`,
      ...infisicalBaseArgs(coords),
    ]);
  }

  async deleteSecret(name: string, envOverride?: string): Promise<void> {
    const coords = resolveSecretsCoords(this.repoRoot, envOverride);
    runInfisical([
      'secrets',
      'delete',
      name,
      ...infisicalBaseArgs(coords),
      '--type',
      'shared',
    ]);
  }

  async exportSecrets(
    envOverride?: string
  ): Promise<ReadonlyMap<string, string>> {
    const coords = resolveSecretsCoords(this.repoRoot, envOverride);
    const raw = runInfisical([
      'export',
      ...infisicalBaseArgs(coords),
      '--format=json',
    ]);
    const parsed: unknown = JSON.parse(raw);
    const map = new Map<string, string>();
    if (!Array.isArray(parsed)) return map;
    for (const item of parsed) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      const rec = item as Record<string, unknown>;
      const key = rec['key'];
      const value = rec['value'];
      if (
        typeof key === 'string' &&
        key.length > 0 &&
        typeof value === 'string'
      ) {
        map.set(key, value);
      }
    }
    return map;
  }

  async listSecretNames(envOverride?: string): Promise<readonly string[]> {
    return [...(await this.exportSecrets(envOverride)).keys()];
  }
}

export async function createInfisicalCliAdminStore(
  options: CreateInfisicalCliAdminStoreOptions
): Promise<SecretAdminStore> {
  const token = await resolveInfisicalAccessTokenForWrites({
    repoRoot: options.repoRoot,
  });
  if (token !== null) {
    process.env['INFISICAL_TOKEN'] = token;
    if (!(process.env['SECRETS_TOKEN'] ?? '').trim()) {
      process.env['SECRETS_TOKEN'] = token;
    }
  } else if (process.env['GITHUB_ACTIONS'] === 'true') {
    throw new Error(
      'Infisical admin CLI needs a token in GitHub Actions, but none was ' +
        'resolved. Export SECRETS_IDENTITY_ID (machine identity) so OIDC ' +
        'can mint INFISICAL_TOKEN, or set SECRETS_TOKEN explicitly. ' +
        'The secrets-auth action should write SECRETS_IDENTITY_ID to GITHUB_ENV.'
    );
  }
  return new InfisicalCliAdminStore(options.repoRoot);
}
