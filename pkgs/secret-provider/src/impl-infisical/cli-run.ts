import { spawnSync } from 'node:child_process';
import { StripeSecretKeys } from '@pkgs/billing-stripe';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { which } from '@pkgs/os/command';
import { resolveSecretsScope } from '@pkgs/secrets-config';
import {
  isSecretsCacheStale,
  mergeSecretsIntoEnv,
  readSecretsCacheMap,
  readSecretsCacheMeta,
  type SecretsCacheEnv,
  writeSecretsCacheMap,
  writeSecretsCacheMeta,
} from '../local-secrets-cache';
import { chmodLocalSecretsCacheFiles } from '../wall-chmod-local-secrets-cache';
import { INFISICAL_CLI_BIN } from './defaults';
import { ensureInfisicalCliConfig } from './ensure-cli-config';
import {
  canFetchInfisicalSecrets,
  exportInfisicalSecretsMap,
} from './export-secrets';
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

function runWithEnv(
  repoRoot: string,
  childArgs: string[],
  childEnv: NodeJS.ProcessEnv
): number {
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

function runWithInjectedEnv(repoRoot: string, childArgs: string[]): number {
  return runWithEnv(repoRoot, childArgs, prepareChildEnv());
}

/** Env vars the CI secrets-auth action injects before this runner. */
const INJECTED_SECRET_MARKERS = [
  'DATABASE_URL',
  'CLOUDFLARE_API_TOKEN',
  StripeSecretKeys.secretKey,
] as const;

function hasInjectedSecrets(): boolean {
  return INJECTED_SECRET_MARKERS.some((key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function asCacheEnv(env: string): SecretsCacheEnv | null {
  if (env === 'dev' || env === 'prd') return env;
  return null;
}

async function runFromDevCache(args: {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: string[];
  readonly nowMs: number;
}): Promise<number | null> {
  const cached = await readSecretsCacheMap(args.configStore, 'dev');
  if (cached === null) return null;

  const meta = await readSecretsCacheMeta(args.configStore);
  if (meta !== null && isSecretsCacheStale(meta, args.nowMs)) {
    process.stderr.write(
      'secrets-run: local secrets cache is older than 24h; ' +
        'run `bun run secrets:pull` to refresh. Continuing offline.\n'
    );
  } else {
    process.stderr.write(
      'secrets-run: using local secrets cache (.cache/secrets/dev.json); ' +
        'skipping Infisical.\n'
    );
  }

  return runWithEnv(
    args.repoRoot,
    args.childArgs,
    mergeSecretsIntoEnv(prepareChildEnv(), cached)
  );
}

async function bootstrapDevCache(args: {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: string[];
  readonly workspaceId: string;
  readonly domain: string;
  readonly nowIso: string;
}): Promise<number | null> {
  if (!which(INFISICAL_CLI_BIN)) return null;

  const baseCoords = {
    repoRoot: args.repoRoot,
    workspaceId: args.workspaceId,
    domain: args.domain,
  };

  if (
    !canFetchInfisicalSecrets({ ...baseCoords, env: 'dev' }) ||
    !canFetchInfisicalSecrets({ ...baseCoords, env: 'prd' })
  ) {
    return null;
  }

  process.stderr.write(
    'secrets-run: no local secrets cache; bootstrapping from Infisical…\n'
  );

  const envs: SecretsCacheEnv[] = ['dev', 'prd'];
  const maps = new Map<SecretsCacheEnv, ReadonlyMap<string, string>>();
  for (const env of envs) {
    const map = exportInfisicalSecretsMap({ ...baseCoords, env });
    await writeSecretsCacheMap(args.configStore, env, map);
    maps.set(env, map);
  }
  await writeSecretsCacheMeta(args.configStore, {
    pulledAt: args.nowIso,
    projectId: args.workspaceId,
    envs,
  });
  chmodLocalSecretsCacheFiles(args.repoRoot);

  const devMap = maps.get('dev');
  if (devMap === undefined) return null;

  process.stderr.write(
    'secrets-run: wrote .cache/secrets/; using cached dev secrets.\n'
  );
  return runWithEnv(
    args.repoRoot,
    args.childArgs,
    mergeSecretsIntoEnv(prepareChildEnv(), devMap)
  );
}

export type RunWithInfisicalSecretsOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: readonly string[];
  /** Injected wall clock (ms) for cache stale checks. */
  readonly nowMs: number;
  /** Injected wall clock ISO for cache meta `pulledAt`. */
  readonly nowIso: string;
};

function runCiInjected(repoRoot: string, childArgs: string[]): number {
  if (!hasInjectedSecrets()) {
    console.error(
      'secrets-run: CI expected secrets in the environment ' +
        `(secrets-auth action). Missing markers: ` +
        `${INJECTED_SECRET_MARKERS.join(', ')}. ` +
        'Ensure the secrets environment is populated (dashboard or `bun run infra provision`).'
    );
    return 1;
  }
  return runWithInjectedEnv(repoRoot, childArgs);
}

async function runDevOfflineFirst(args: {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: string[];
  readonly workspaceId: string;
  readonly domain: string;
  readonly nowMs: number;
  readonly nowIso: string;
}): Promise<number> {
  const fromCache = await runFromDevCache({
    repoRoot: args.repoRoot,
    configStore: args.configStore,
    childArgs: args.childArgs,
    nowMs: args.nowMs,
  });
  if (fromCache !== null) return fromCache;

  const bootstrapped = await bootstrapDevCache({
    repoRoot: args.repoRoot,
    configStore: args.configStore,
    childArgs: args.childArgs,
    workspaceId: args.workspaceId,
    domain: args.domain,
    nowIso: args.nowIso,
  });
  if (bootstrapped !== null) return bootstrapped;

  process.stderr.write(
    'secrets-run: Infisical unavailable and no local cache; ' +
      'falling back to local/injected env. Run `bun run secrets:pull` when online.\n'
  );
  return runWithInjectedEnv(args.repoRoot, args.childArgs);
}

function runPrdInfisicalFirst(args: {
  readonly repoRoot: string;
  readonly env: string;
  readonly workspaceId: string;
  readonly domain: string;
  readonly childArgs: string[];
}): number {
  if (hasInjectedSecrets() || !which(INFISICAL_CLI_BIN)) {
    return runWithInjectedEnv(args.repoRoot, args.childArgs);
  }
  const coords = {
    repoRoot: args.repoRoot,
    workspaceId: args.workspaceId,
    env: args.env,
    domain: args.domain,
  };
  if (!canFetchInfisicalSecrets(coords)) {
    console.error(
      'secrets-run: Infisical unavailable (login/network/project). ' +
        'Run `infisical login` or use LOCAL_SECRETS=1 with injected env.'
    );
    return 1;
  }
  return runWithInfisicalCli({ ...coords, childArgs: args.childArgs });
}

/**
 * Run a command with secrets injected (CI env, local cache, or Infisical CLI).
 */
export async function runWithInfisicalSecrets(
  options: RunWithInfisicalSecretsOptions
): Promise<number> {
  const { repoRoot, childArgs, nowMs, nowIso } = options;
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
  const args = [...childArgs];

  process.stderr.write(
    `secrets-run: projectId=${scope.projectId} env=${scope.env} endpoint=${endpoint}\n`
  );
  if (scope.env === 'prd' && !args.some((a) => a.includes('infra'))) {
    process.stderr.write(
      'secrets-run: warning — SECRETS_ENV=prd injects production secrets; use only for `bun run infra` / deploy.\n'
    );
  }

  const isCi =
    process.env['GITHUB_ACTIONS'] === 'true' || process.env['CI'] === 'true';
  if (isCi) return runCiInjected(repoRoot, args);

  const forceLocal =
    process.env['LOCAL_SECRETS']?.trim() === '1' ||
    process.env['LOCAL_SECRETS']?.trim().toLowerCase() === 'true';
  if (forceLocal) {
    process.stderr.write(
      'secrets-run: LOCAL_SECRETS=1 — skipping Infisical; using process env / local setup seeds.\n'
    );
    return runWithInjectedEnv(repoRoot, args);
  }

  if (asCacheEnv(scope.env) === 'dev') {
    return runDevOfflineFirst({
      repoRoot,
      configStore: options.configStore,
      childArgs: args,
      workspaceId: scope.projectId,
      domain: endpoint,
      nowMs,
      nowIso,
    });
  }

  return runPrdInfisicalFirst({
    repoRoot,
    env: scope.env,
    workspaceId: scope.projectId,
    domain: endpoint,
    childArgs: args,
  });
}
