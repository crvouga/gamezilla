// @io-wall-ok — deploy helper shared by the Worker apps' deploy scripts.
/**
 * Ships one Worker's code to the environment in `SECRETS_ENV`:
 *
 *   wrangler deploy --config <rendered> --secrets-file <payload>
 *
 * The config is `wrangler.toml` rendered for the environment (its name and
 * Durable Object `script_name` from the naming patterns); secrets upload
 * atomically with the version. Hostnames are not wrangler's: the OpenTofu
 * edge stack binds them after every Worker exists. Nothing here ever deletes
 * a Worker — a Durable Object migration error fails the deploy.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EnvFile } from '@libs/infra/public/env-file';
import { envFile } from '@libs/infra/public/envs';
import {
  renderWranglerConfig,
  type WorkerRole,
  type WranglerConfig,
} from '@libs/infra/public/wrangler';

export function activeEnvFile(): EnvFile {
  const name = (process.env['SECRETS_ENV'] ?? '').trim();
  if (name.length === 0) throw new Error('SECRETS_ENV is required');
  return envFile(name);
}

/** Writes `<appDir>/.cache/wrangler.<env>.json`; returns its path. */
export function writeRenderedWranglerConfig(
  appDir: string,
  role: WorkerRole
): string {
  const env = activeEnvFile();
  const base = Bun.TOML.parse(
    readFileSync(join(appDir, 'wrangler.toml'), 'utf8')
  ) as WranglerConfig;
  const outDir = join(appDir, '.cache');
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `wrangler.${env.env}.json`);
  writeFileSync(
    path,
    `${JSON.stringify(renderWranglerConfig(base, env, role), null, 2)}\n`
  );
  return path;
}

function wranglerEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: activeEnvFile().cloudflare.account_id,
    WRANGLER_SEND_METRICS: 'false',
  };
}

export function deployWorker(options: {
  readonly appDir: string;
  readonly role: WorkerRole;
  readonly secrets: Readonly<Record<string, string>>;
}): void {
  const config = writeRenderedWranglerConfig(options.appDir, options.role);
  const secretsFile = join(
    options.appDir,
    '.cache',
    `secrets.${process.pid}.json`
  );
  const args = ['deploy', '--config', config];
  if (Object.keys(options.secrets).length > 0) {
    writeFileSync(secretsFile, JSON.stringify(options.secrets), {
      mode: 0o600,
    });
    args.push('--secrets-file', secretsFile);
  }
  try {
    const result = Bun.spawnSync(['wrangler', ...args], {
      cwd: options.appDir,
      env: wranglerEnv(),
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `${options.role} worker: wrangler deploy failed (exit ${String(result.exitCode)})`
      );
    }
  } finally {
    rmSync(secretsFile, { force: true });
  }
}
