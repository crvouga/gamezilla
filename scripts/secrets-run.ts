/**
 * Run a command with secrets injected from the configured secret backend.
 *
 * Defaults come from repo-root `.infisical.json` (`SECRETS_ENV` defaults to `dev`).
 * Override with `SECRETS_PROJECT_ID` / `SECRETS_ENV` / `SECRETS_ADDR`.
 *
 * Local: delegates to `infisical run` (user login).
 * CI: `Infisical/secrets-action` injects env vars before invoking this script.
 */
import { spawnSync } from 'node:child_process';
import { which } from '@pkgs/os/command';
import { resolveSecretsScope } from '@pkgs/secrets-config/infisical-json';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

/** Drop legacy Vercel Remote Cache creds so Turbo never contacts vercel.com. */
function stripVercelTurboRemoteCacheEnv(
  env: Record<string, string | undefined>
): void {
  delete env.TURBO_TOKEN;
  delete env.TURBO_TEAM;
  delete env.TURBO_API;
  delete env.TURBO_CACHE;
}

function runWithInfisicalCli(
  workspaceId: string,
  env: string,
  domain: string,
  childArgs: string[]
): number {
  const childEnv = { ...process.env };
  delete childEnv.CURSOR_AGENT;
  delete childEnv.CURSOR_TRACE_ID;
  stripVercelTurboRemoteCacheEnv(childEnv);

  const result = spawnSync(
    'infisical',
    [
      'run',
      '--projectId',
      workspaceId,
      '--env',
      env,
      '--domain',
      domain,
      '--',
      ...childArgs,
    ],
    {
      cwd: REPO_ROOT,
      env: childEnv,
      stdio: 'inherit',
    }
  );

  if (result.error !== undefined) {
    console.error(
      `secrets-run: failed to spawn infisical: ${result.error.message}`
    );
    return 1;
  }
  return result.status ?? 1;
}

function runWithInjectedEnv(childArgs: string[]): number {
  const childEnv = { ...process.env };
  delete childEnv.CURSOR_AGENT;
  delete childEnv.CURSOR_TRACE_ID;
  stripVercelTurboRemoteCacheEnv(childEnv);

  const [cmd, ...args] = childArgs;
  if (cmd === undefined) {
    console.error('secrets-run: missing command');
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
      `secrets-run: failed to spawn ${cmd}: ${result.error.message}`
    );
    return 1;
  }
  return result.status ?? 1;
}

const childArgs = process.argv.slice(2);
if (childArgs.length === 0) {
  console.error(
    'usage: bun run scripts/secrets-run.ts -- <command> [args…]\n' +
      'example: bun run scripts/secrets-run.ts -- turbo dev --ui=tui'
  );
  process.exit(1);
}

const { workspaceId, env, domain } = resolveSecretsScope(REPO_ROOT);

process.stderr.write(
  `secrets-run: workspaceId=${workspaceId} env=${env} domain=${domain}\n`
);
if (env === 'prd' && !childArgs.some((a) => a.includes('infra'))) {
  process.stderr.write(
    'secrets-run: warning — SECRETS_ENV=prd injects production secrets; use only for `bun run infra` / deploy.\n'
  );
}

const isCi = process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';

/** Env vars Infisical OIDC injects before this script runs in CI. */
const INJECTED_SECRET_MARKERS = [
  'DATABASE_URL',
  'CLOUDFLARE_API_TOKEN',
  'STRIPE_SECRET_KEY',
  'EXPO_TOKEN',
] as const;

function hasInjectedSecrets(): boolean {
  return INJECTED_SECRET_MARKERS.some((key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

if (isCi) {
  if (!hasInjectedSecrets()) {
    console.error(
      'secrets-run: CI expected Infisical OIDC secrets in the environment ' +
        `(secrets-auth action, env=${env}). Missing markers: ` +
        `${INJECTED_SECRET_MARKERS.join(', ')}. ` +
        'Ensure the Infisical environment is populated (dashboard or `bun run infra provision`).'
    );
    process.exit(1);
  }
  process.exit(runWithInjectedEnv(childArgs));
}

if (hasInjectedSecrets() || !which('infisical')) {
  process.exit(runWithInjectedEnv(childArgs));
}

process.exit(runWithInfisicalCli(workspaceId, env, domain, childArgs));
