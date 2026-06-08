/**
 * Run a command with secrets from Vault.
 *
 * Defaults come from repo-root `.vault.yaml`.
 * Override with `VAULT_PROJECT` / `VAULT_CONFIG` (e.g. `VAULT_CONFIG=prd`
 * for infra / prod seeds).
 *
 * When the `vault` CLI wrapper is on PATH, delegates to
 * `vault run --project … --config … -- <cmd>`. Otherwise (e.g. CI with OIDC
 * `VAULT_TOKEN` only) fetches the KV path over HTTP and injects fields into
 * the child process env.
 */
import { spawnSync } from 'node:child_process';
import { which } from '@pkgs/os/command';
import {
  readVaultYamlDefaults,
  resolveVaultYamlPath,
} from '@pkgs/vault/vault-yaml';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

function resolveScope(): {
  readonly project: string;
  readonly config: string;
  readonly addr: string;
  readonly mount: string;
} {
  const fromYaml = readVaultYamlDefaults(resolveVaultYamlPath(REPO_ROOT));
  const project = process.env.VAULT_PROJECT?.trim() || fromYaml.project;
  const config = process.env.VAULT_CONFIG?.trim() || fromYaml.config;
  const addr = process.env.VAULT_ADDR?.trim() || fromYaml.addr;
  const mount = process.env.VAULT_MOUNT?.trim() || fromYaml.mount;
  return { project, config, addr, mount };
}

async function fetchKvEnv(
  token: string,
  addr: string,
  mount: string,
  path: string
): Promise<Record<string, string>> {
  const base = addr.replace(/\/$/, '');
  const url = `${base}/v1/${mount}/data/${path}`;
  const response = await fetch(url, {
    headers: {
      'X-Vault-Token': token,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Vault KV read failed: HTTP ${response.status}`);
  }
  const json = (await response.json()) as {
    data?: { data?: Record<string, string> };
  };
  const data = json.data?.data;
  if (data === undefined || typeof data !== 'object') {
    throw new Error('Vault KV read: unexpected response shape');
  }
  return data;
}

function runWithCli(
  project: string,
  config: string,
  childArgs: string[]
): number {
  const childEnv = { ...process.env };
  delete childEnv.CURSOR_AGENT;
  delete childEnv.CURSOR_TRACE_ID;

  const result = spawnSync(
    'vault',
    ['run', '--project', project, '--config', config, '--', ...childArgs],
    {
      cwd: REPO_ROOT,
      env: childEnv,
      stdio: 'inherit',
    }
  );

  if (result.error !== undefined) {
    console.error(`vault-run: failed to spawn vault: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

async function runWithHttpInject(
  token: string,
  addr: string,
  mount: string,
  project: string,
  config: string,
  childArgs: string[]
): Promise<number> {
  return fetchKvEnv(token, addr, mount, `${project}/${config}`)
    .then((secrets) => {
      const childEnv = { ...process.env, ...secrets };
      delete childEnv.CURSOR_AGENT;
      delete childEnv.CURSOR_TRACE_ID;

      const [cmd, ...args] = childArgs;
      if (cmd === undefined) {
        console.error('vault-run: missing command');
        return 1;
      }

      const result = spawnSync(cmd, args, {
        cwd: REPO_ROOT,
        env: childEnv,
        stdio: 'inherit',
        shell: childArgs.length === 1,
      });

      if (result.error !== undefined) {
        console.error(
          `vault-run: failed to spawn ${cmd}: ${result.error.message}`
        );
        return 1;
      }
      return result.status ?? 1;
    })
    .catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`vault-run: ${msg}`);
      return 1;
    });
}

const childArgs = process.argv.slice(2);
if (childArgs.length === 0) {
  console.error(
    'usage: bun run scripts/vault-run.ts -- <command> [args…]\n' +
      'example: bun run scripts/vault-run.ts -- turbo dev --ui=tui'
  );
  process.exit(1);
}

const { project, config, addr, mount } = resolveScope();

if (which('vault')) {
  process.exit(runWithCli(project, config, childArgs));
}

const token = (process.env.VAULT_TOKEN ?? '').trim();
if (token.length === 0) {
  console.error(
    'vault-run: `vault` CLI not on PATH and VAULT_TOKEN is unset. ' +
      'Install the vault wrapper (`./scripts/install-cli.sh` from secret-store) ' +
      'or authenticate via OIDC / `vault login`.'
  );
  process.exit(1);
}

process.exit(
  await runWithHttpInject(token, addr, mount, project, config, childArgs)
);
