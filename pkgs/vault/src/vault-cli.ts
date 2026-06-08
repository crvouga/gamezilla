import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  readVaultYamlDefaults,
  resolveVaultTokenFilePath,
  resolveVaultYamlPath,
  type VaultYamlDefaults,
} from './vault-yaml';

const VAULT_TOKEN_ENV_NAME = 'VAULT_TOKEN';

export type VaultTokenSource = 'env' | 'file';

export type VaultTokenResult = {
  token: string;
  source: VaultTokenSource;
};

export type VaultCliOptions = {
  tokenEnvName?: string;
  processEnv?: NodeJS.ProcessEnv;
  execSyncFn?: typeof execSync;
  cwd?: string;
  readFileFn?: (path: string, encoding: BufferEncoding) => string;
};

function createVaultCliError(message: string, options?: ErrorOptions): Error {
  const error = new Error(message, options);
  error.name = 'VaultCliError';
  return error;
}

function trimOpt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

type ResolvedVaultCliOptions = {
  tokenEnvName: string;
  processEnv: NodeJS.ProcessEnv;
  execSyncFn: typeof execSync;
  cwd: string;
  readFileFn: (path: string, encoding: BufferEncoding) => string;
};

function resolveTokenEnvName(tokenEnvName?: string): string {
  const trimmed = (tokenEnvName ?? VAULT_TOKEN_ENV_NAME).trim();
  if (trimmed.length === 0) {
    throw createVaultCliError('VaultCli: tokenEnvName must be non-empty');
  }
  return trimmed;
}

function resolveVaultCliOptions(
  options?: VaultCliOptions
): ResolvedVaultCliOptions {
  const opts = options ?? {};
  return {
    tokenEnvName: resolveTokenEnvName(opts.tokenEnvName),
    processEnv: opts.processEnv ?? process.env,
    execSyncFn: opts.execSyncFn ?? execSync,
    cwd: opts.cwd ?? process.cwd(),
    readFileFn: opts.readFileFn ?? readFileSync,
  };
}

export class VaultCli {
  private readonly tokenEnvName: string;
  private readonly processEnv: NodeJS.ProcessEnv;
  private readonly execSyncFn: typeof execSync;
  private readonly cwd: string;
  private readonly readFileFn: (path: string, encoding: BufferEncoding) => string;

  constructor(options?: VaultCliOptions) {
    const resolved = resolveVaultCliOptions(options);
    this.tokenEnvName = resolved.tokenEnvName;
    this.processEnv = resolved.processEnv;
    this.execSyncFn = resolved.execSyncFn;
    this.cwd = resolved.cwd;
    this.readFileFn = resolved.readFileFn;
  }

  resolveToken(): VaultTokenResult {
    const fromEnv = this.processEnv[this.tokenEnvName];
    if (typeof fromEnv === 'string') {
      const trimmed = fromEnv.trim();
      if (trimmed.length > 0) {
        return { token: trimmed, source: 'env' };
      }
    }

    const tokenPath = resolveVaultTokenFilePath();
    try {
      const fromFile = this.readFileFn(tokenPath, 'utf8').trim();
      if (fromFile.length > 0) {
        return { token: fromFile, source: 'file' };
      }
    } catch (error: unknown) {
      throw createVaultCliError(
        `failed to resolve ${this.tokenEnvName} from ${tokenPath}`,
        { cause: error }
      );
    }

    throw createVaultCliError(
      `${this.tokenEnvName} is unset and ${tokenPath} is empty or missing`
    );
  }

  resolveScope(): VaultYamlDefaults {
    const fromYaml = readVaultYamlDefaults(resolveVaultYamlPath(this.cwd));
    const project =
      trimOpt(this.processEnv['VAULT_PROJECT']) ?? fromYaml.project;
    const config = trimOpt(this.processEnv['VAULT_CONFIG']) ?? fromYaml.config;
    const addr = trimOpt(this.processEnv['VAULT_ADDR']) ?? fromYaml.addr;
    const mount = trimOpt(this.processEnv['VAULT_MOUNT']) ?? fromYaml.mount;
    return { addr, mount, project, config };
  }

  tryConfigureGetProjectPlain(): string | null {
    return this.resolveScope().project;
  }

  tryConfigureGetConfigPlain(): string | null {
    return this.resolveScope().config;
  }

  setSecret(name: string, value: string): void {
    const { mount, project, config } = this.resolveScope();
    const path = `${project}/${config}`;
    const cmd = [
      'vault',
      'kv',
      'patch',
      `-mount=${mount}`,
      path,
      `${name}=${value}`,
    ].join(' ');
    this.execSyncFn(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: this.cwd,
      env: this.processEnv,
    });
  }
}
