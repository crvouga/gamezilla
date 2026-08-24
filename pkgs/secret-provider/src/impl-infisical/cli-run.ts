import { spawnSync } from 'node:child_process';
import { StripeSecretKeys } from '@pkgs/billing-stripe';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { which } from '@pkgs/os/command';
import { resolveSecretsScope } from '@pkgs/secrets-config';
import { INFISICAL_CLI_BIN } from './defaults';
import { ensureInfisicalCliConfig } from './ensure-cli-config';
import { resolveInfisicalEndpoint } from './resolve-endpoint';

function prepareChildEnv(): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  delete childEnv['CURSOR_AGENT'];
  delete childEnv['CURSOR_TRACE_ID'];
  return childEnv;
}

function infisicalCliEnv(): NodeJS.ProcessEnv {
  const env = prepareChildEnv();
  env['INFISICAL_DISABLE_MIGRATION_NOTICE'] = '1';
  return env;
}

function infisicalProjectArgs(args: {
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
}): string[] {
  return [
    '--projectId',
    args.workspaceId,
    '--env',
    args.env,
    '--domain',
    args.domain,
  ];
}

/**
 * True when the Infisical CLI can fetch secrets for this project/env.
 * Used so a later `infisical run` child failure is not mistaken for
 * Infisical auth/network failure (and re-run without secrets).
 */
function canFetchInfisicalSecrets(args: {
  readonly repoRoot: string;
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
}): boolean {
  const result = spawnSync(
    INFISICAL_CLI_BIN,
    ['export', ...infisicalProjectArgs(args), '--format=json'],
    {
      cwd: args.repoRoot,
      env: infisicalCliEnv(),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  if (result.error !== undefined || result.status !== 0) return false;
  const raw = (result.stdout ?? '').trim();
  if (raw.length === 0) return false;
  try {
    return Array.isArray(JSON.parse(raw));
  } catch {
    return false;
  }
}

function runWithInfisicalCli(args: {
  readonly repoRoot: string;
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
  readonly childArgs: string[];
}): number {
  const result = spawnSync(
    INFISICAL_CLI_BIN,
    ['run', ...infisicalProjectArgs(args), '--', ...args.childArgs],
    {
      cwd: args.repoRoot,
      env: infisicalCliEnv(),
      stdio: 'inherit',
    }
  );

  if (result.error !== undefined) {
    console.error(
      `secrets-run: failed to spawn ${INFISICAL_CLI_BIN}: ${result.error.message}`
    );
    return 1;
  }
  return result.status ?? 1;
}

function runWithInjectedEnv(repoRoot: string, childArgs: string[]): number {
  const childEnv = prepareChildEnv();
  const [cmd, ...args] = childArgs;
  if (cmd === undefined) {
    console.error('secrets-run: missing command');
    return 1;
  }

  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
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

/** Env vars the CI secrets-auth action injects before this runner. */
const INJECTED_SECRET_MARKERS = [
  'DATABASE_URL',
  'CLOUDFLARE_API_TOKEN',
  StripeSecretKeys.secretKey,
  'EXPO_TOKEN',
] as const;

function hasInjectedSecrets(): boolean {
  return INJECTED_SECRET_MARKERS.some((key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export type RunWithInfisicalSecretsOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: readonly string[];
};

/**
 * Run a command with secrets injected (CI env or Infisical CLI locally).
 */
export async function runWithInfisicalSecrets(
  options: RunWithInfisicalSecretsOptions
): Promise<number> {
  const { repoRoot, childArgs } = options;
  if (childArgs.length === 0) {
    console.error(
      'usage: bun run tools/scripts/secrets-run.ts -- <command> [args…]\n' +
        'example: bun run tools/scripts/secrets-run.ts -- turbo dev --ui=tui'
    );
    return 1;
  }

  const scope = await resolveSecretsScope(options.configStore);
  await ensureInfisicalCliConfig(options.configStore, scope);
  const endpoint = resolveInfisicalEndpoint(scope);

  process.stderr.write(
    `secrets-run: projectId=${scope.projectId} env=${scope.env} endpoint=${endpoint}\n`
  );
  if (scope.env === 'prd' && !childArgs.some((a) => a.includes('infra'))) {
    process.stderr.write(
      'secrets-run: warning — SECRETS_ENV=prd injects production secrets; use only for `bun run infra` / deploy.\n'
    );
  }

  const isCi =
    process.env['GITHUB_ACTIONS'] === 'true' || process.env['CI'] === 'true';
  const args = [...childArgs];
  const forceLocal =
    process.env['LOCAL_SECRETS']?.trim() === '1' ||
    process.env['LOCAL_SECRETS']?.trim().toLowerCase() === 'true';

  if (isCi) {
    if (!hasInjectedSecrets()) {
      console.error(
        'secrets-run: CI expected secrets in the environment ' +
          `(secrets-auth action, env=${scope.env}). Missing markers: ` +
          `${INJECTED_SECRET_MARKERS.join(', ')}. ` +
          'Ensure the secrets environment is populated (dashboard or `bun run infra provision`).'
      );
      return 1;
    }
    return runWithInjectedEnv(repoRoot, args);
  }

  if (forceLocal || hasInjectedSecrets() || !which(INFISICAL_CLI_BIN)) {
    if (forceLocal) {
      process.stderr.write(
        'secrets-run: LOCAL_SECRETS=1 — skipping Infisical; using process env / local setup seeds.\n'
      );
    }
    return runWithInjectedEnv(repoRoot, args);
  }

  const coords = {
    repoRoot,
    workspaceId: scope.projectId,
    env: scope.env,
    domain: endpoint,
  };

  if (!canFetchInfisicalSecrets(coords)) {
    // Local `dev` must stay self-contained when Infisical login/network fails.
    if (scope.env === 'dev') {
      process.stderr.write(
        'secrets-run: Infisical unavailable; falling back to local/injected env for SECRETS_ENV=dev.\n'
      );
      return runWithInjectedEnv(repoRoot, args);
    }
    console.error(
      'secrets-run: Infisical unavailable (login/network/project). ' +
        'Run `infisical login` or use LOCAL_SECRETS=1 with injected env.'
    );
    return 1;
  }

  // Child non-zero exits must not trigger a second run without secrets —
  // that masked real failures and dropped TURBO_TOKEN/TURBO_TEAM.
  return runWithInfisicalCli({ ...coords, childArgs: args });
}
