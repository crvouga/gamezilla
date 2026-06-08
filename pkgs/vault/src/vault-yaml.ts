import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { VAULT_DEFAULTS } from './vault-defaults';

export type VaultYamlDefaults = {
  readonly addr: string;
  readonly mount: string;
  readonly project: string;
  readonly config: string;
};

export function resolveVaultYamlPath(cwd: string): string {
  return join(cwd, '.vault.yaml');
}

export function formatVaultYamlFromDefaults(): string {
  const { addr, mount, project, config } = VAULT_DEFAULTS;
  return [
    '# Generated from @pkgs/vault — edit pkgs/vault/src/vault-defaults.ts then:',
    '#   bun run --filter @pkgs/vault write-vault-yaml',
    `addr: ${addr}`,
    `mount: ${mount}`,
    `project: ${project}`,
    `config: ${config}`,
    '',
  ].join('\n');
}

export function readVaultYamlDefaults(
  vaultYamlPath: string
): VaultYamlDefaults {
  let text: string;
  try {
    text = readFileSync(vaultYamlPath, 'utf8');
  } catch {
    return { ...VAULT_DEFAULTS };
  }

  const addr = text.match(/^addr:\s*(\S+)/m)?.[1] ?? VAULT_DEFAULTS.addr;
  const mount = text.match(/^mount:\s*(\S+)/m)?.[1] ?? VAULT_DEFAULTS.mount;
  const project =
    text.match(/^project:\s*(\S+)/m)?.[1] ?? VAULT_DEFAULTS.project;
  const config = text.match(/^config:\s*(\S+)/m)?.[1] ?? VAULT_DEFAULTS.config;
  return { addr, mount, project, config };
}

export function resolveVaultTokenFilePath(): string {
  return join(homedir(), '.vault-token');
}
