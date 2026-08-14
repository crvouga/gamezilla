import { spawnSync } from 'node:child_process';
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

function runWithInfisicalCli(args: {
  readonly repoRoot: string;
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
  readonly childArgs: string[];
}): number {
  const childEnv = prepareChildEnv();
  childEnv['INFISICAL_DISABLE_MIGRATION_NOTICE'] = '1';

  const result = spawnSync(
    INFISICAL_CLI_BIN,
    [
      'run',
      '--projectId',
      args.workspaceId,
      '--env',
      args.env,
      '--domain',
      args.domain,
      '--',
      ...args.childArgs,
    ],
    {
      cwd: args.repoRoot,
      env: childEnv,
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
  'STRIPE_SECRET_KEY',
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

  const infisicalStatus = runWithInfisicalCli({
    repoRoot,
    workspaceId: scope.projectId,
    env: scope.env,
    domain: endpoint,
    childArgs: args,
  });
  if (infisicalStatus === 0) {
    return 0;
  }
  // Local `dev` must stay self-contained when Infisical login/network fails.
  if (scope.env === 'dev') {
    process.stderr.write(
      'secrets-run: Infisical failed; falling back to local/injected env for SECRETS_ENV=dev.\n'
    );
    return runWithInjectedEnv(repoRoot, args);
  }
  return infisicalStatus;
}
