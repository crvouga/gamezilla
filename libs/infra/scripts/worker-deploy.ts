// @io-wall-ok — deploy helper shared by the Worker apps' deploy scripts.
/**
 * Ships one Worker's code to the environment in `SECRETS_ENV`:
 *
 *   wrangler deploy --config <rendered> --secrets-file <payload>
 *
 * The config is `wrangler.toml` rendered for the environment (its name,
 * Durable Object `script_name` and the ids of resources OpenTofu made for
 * it); secrets upload atomically with the version. Hostnames are not
 * wrangler's: OpenTofu binds them after the Worker exists. Nothing here ever
 * deletes a Worker — a Durable Object migration error fails the deploy.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EnvFile } from '@libs/infra/public/env-file';
import { envFile } from '@libs/infra/public/envs';
import { GLOBAL } from '@libs/infra/public/global';
import {
  renderAuthRelayWranglerConfig,
  renderWranglerConfig,
  type WorkerResources,
  type WorkerRole,
  type WranglerConfig,
} from '@libs/infra/public/wrangler';

export function activeEnvFile(): EnvFile {
  const name = (process.env['SECRETS_ENV'] ?? '').trim();
  if (name.length === 0) throw new Error('SECRETS_ENV is required');
  return envFile(name);
}

function readBaseConfig(appDir: string): WranglerConfig {
  return Bun.TOML.parse(
    readFileSync(join(appDir, 'wrangler.toml'), 'utf8')
  ) as WranglerConfig;
}

/** Writes `<appDir>/.cache/wrangler.<label>.json`; returns its path. */
function writeConfig(
  appDir: string,
  label: string,
  config: WranglerConfig
): string {
  const outDir = join(appDir, '.cache');
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `wrangler.${label}.json`);
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return path;
}

function writeRenderedWranglerConfig(
  appDir: string,
  role: WorkerRole,
  resources: WorkerResources = {}
): string {
  const env = activeEnvFile();
  return writeConfig(
    appDir,
    env.env,
    renderWranglerConfig(readBaseConfig(appDir), env, role, resources)
  );
}

function runWrangler(options: {
  readonly appDir: string;
  readonly label: string;
  readonly config: string;
  readonly accountId: string;
  readonly secrets: Readonly<Record<string, string>>;
}): void {
  const secretsFile = join(
    options.appDir,
    '.cache',
    `secrets.${process.pid}.json`
  );
  const args = ['deploy', '--config', options.config];
  if (Object.keys(options.secrets).length > 0) {
    writeFileSync(secretsFile, JSON.stringify(options.secrets), {
      mode: 0o600,
    });
    args.push('--secrets-file', secretsFile);
  }
  try {
    const result = Bun.spawnSync(['wrangler', ...args], {
      cwd: options.appDir,
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: options.accountId,
        WRANGLER_SEND_METRICS: 'false',
      },
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `${options.label} worker: wrangler deploy failed (exit ${String(result.exitCode)})`
      );
    }
  } finally {
    rmSync(secretsFile, { force: true });
  }
}

export function deployWorker(options: {
  readonly appDir: string;
  readonly role: WorkerRole;
  readonly secrets: Readonly<Record<string, string>>;
  readonly resources?: WorkerResources;
}): void {
  runWrangler({
    appDir: options.appDir,
    label: options.role,
    config: writeRenderedWranglerConfig(
      options.appDir,
      options.role,
      options.resources
    ),
    accountId: activeEnvFile().cloudflare.account_id,
    secrets: options.secrets,
  });
}

/** The global OAuth callback relay: one Worker, not one per environment. */
export function deployAuthRelayWorker(options: {
  readonly appDir: string;
}): void {
  runWrangler({
    appDir: options.appDir,
    label: 'auth-relay',
    config: writeConfig(
      options.appDir,
      'global',
      renderAuthRelayWranglerConfig(readBaseConfig(options.appDir))
    ),
    accountId: GLOBAL.auth_relay.account_id,
    secrets: {},
  });
}
