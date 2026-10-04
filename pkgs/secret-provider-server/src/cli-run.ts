import { spawnSync } from 'node:child_process';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { which } from '@pkgs/os-server/command';
import { INFISICAL_CLI_BIN } from '@pkgs/secret-provider-shared/defaults';
import type {
  SecretsCacheEnv,
  SecretsEnvs,
} from '@pkgs/secret-provider-shared/local-secrets-cache';
import {
  isSecretsCacheStale,
  mergeSecretsIntoEnv,
  readSecretsCacheMap,
  readSecretsCacheMeta,
  secretsCacheRelPath,
  writeSecretsCacheMap,
  writeSecretsCacheMeta,
} from '@pkgs/secret-provider-shared/local-secrets-cache';
import { resolveInfisicalEndpoint } from '@pkgs/secret-provider-shared/resolve-endpoint';
import { resolveSecretsScope } from '@pkgs/secrets-config-server/secrets-scope';
import { ensureInfisicalCliConfig } from './ensure-cli-config';
import {
  canFetchInfisicalSecrets,
  exportInfisicalSecretsMap,
} from './export-secrets';
import { chmodLocalSecretsCacheFiles } from './wall-chmod-local-secrets-cache';

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
] as const;

function hasInjectedSecrets(): boolean {
  return INJECTED_SECRET_MARKERS.some((key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

async function runFromCache(args: {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: string[];
  readonly env: SecretsCacheEnv;
  readonly nowMs: number;
}): Promise<number | null> {
  const cached = await readSecretsCacheMap(args.configStore, args.env);
  if (cached === null) return null;

  const meta = await readSecretsCacheMeta(args.configStore);
  if (meta !== null && isSecretsCacheStale(meta, args.nowMs)) {
    process.stderr.write(
      'secrets-run: local secrets cache is older than 24h; ' +
        'run `bun run secrets:pull` to refresh. Continuing offline.\n'
    );
  } else {
    process.stderr.write(
      `secrets-run: using local secrets cache (${secretsCacheRelPath(args.env)}); ` +
        'skipping Infisical.\n'
    );
  }

  return runWithEnv(
    args.repoRoot,
    args.childArgs,
    mergeSecretsIntoEnv(prepareChildEnv(), cached)
  );
}

async function bootstrapCache(args: {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: string[];
  readonly workspaceId: string;
  readonly domain: string;
  readonly env: SecretsCacheEnv;
  readonly allEnvs: readonly SecretsCacheEnv[];
  readonly nowIso: string;
}): Promise<number | null> {
  if (!which(INFISICAL_CLI_BIN)) return null;

  const baseCoords = {
    repoRoot: args.repoRoot,
    workspaceId: args.workspaceId,
    domain: args.domain,
  };

  if (
    !args.allEnvs.every((env) =>
      canFetchInfisicalSecrets({ ...baseCoords, env })
    )
  ) {
    return null;
  }

  process.stderr.write(
    'secrets-run: no local secrets cache; bootstrapping from Infisical…\n'
  );

  const maps = new Map<SecretsCacheEnv, ReadonlyMap<string, string>>();
  for (const env of args.allEnvs) {
    const map = exportInfisicalSecretsMap({ ...baseCoords, env });
    await writeSecretsCacheMap(args.configStore, env, map);
    maps.set(env, map);
  }
  await writeSecretsCacheMeta(args.configStore, {
    pulledAt: args.nowIso,
    projectId: args.workspaceId,
    envs: args.allEnvs,
  });
  chmodLocalSecretsCacheFiles(args.repoRoot, args.allEnvs);

  const activeMap = maps.get(args.env);
  if (activeMap === undefined) return null;

  process.stderr.write(
    `secrets-run: wrote .cache/secrets/; using cached ${args.env} secrets.\n`
  );
  return runWithEnv(
    args.repoRoot,
    args.childArgs,
    mergeSecretsIntoEnv(prepareChildEnv(), activeMap)
  );
}

export type RunWithInfisicalSecretsOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: readonly string[];
  /** Which environments exist and which are production (caller decides). */
  readonly envs: SecretsEnvs;
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

/** Non-production: prefer `.cache/secrets/<env>.json`, bootstrap it once, else local env. */
async function runOfflineFirst(args: {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: string[];
  readonly workspaceId: string;
  readonly domain: string;
  readonly env: SecretsCacheEnv;
  readonly allEnvs: readonly SecretsCacheEnv[];
  readonly nowMs: number;
  readonly nowIso: string;
}): Promise<number> {
  const fromCache = await runFromCache(args);
  if (fromCache !== null) return fromCache;

  const bootstrapped = await bootstrapCache(args);
  if (bootstrapped !== null) return bootstrapped;

  process.stderr.write(
    'secrets-run: Infisical unavailable and no local cache; ' +
      'falling back to local/injected env. Run `bun run secrets:pull` when online.\n'
  );
  return runWithInjectedEnv(args.repoRoot, args.childArgs);
}

/** Production: never from the local cache — injected env or the Infisical CLI. */
function runInfisicalFirst(args: {
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

function forceLocalSecrets(): boolean {
  const raw = process.env['LOCAL_SECRETS']?.trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

/** Rejects an environment the caller does not know; warns on production. */
function checkScopeEnv(
  env: string,
  envs: SecretsEnvs,
  args: readonly string[]
): boolean {
  if (!envs.all.includes(env)) {
    console.error(
      `secrets-run: unknown secrets env ${JSON.stringify(env)} (known: ${envs.all.join(', ')})`
    );
    return false;
  }
  if (envs.production.includes(env) && !args.some((a) => a.includes('infra'))) {
    process.stderr.write(
      `secrets-run: warning — SECRETS_ENV=${env} injects production secrets; use only for \`bun run infra\` / deploy.\n`
    );
  }
  return true;
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
      'usage: bun run libs/secrets-server/scripts/secrets-run.ts -- <command> [args…]\n' +
        'example: bun run libs/secrets-server/scripts/secrets-run.ts -- turbo dev --ui=tui'
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
  if (!checkScopeEnv(scope.env, options.envs, args)) return 1;

  const isCi =
    process.env['GITHUB_ACTIONS'] === 'true' || process.env['CI'] === 'true';
  if (isCi) return runCiInjected(repoRoot, args);

  if (forceLocalSecrets()) {
    process.stderr.write(
      'secrets-run: LOCAL_SECRETS=1 — skipping Infisical; using process env / local setup seeds.\n'
    );
    return runWithInjectedEnv(repoRoot, args);
  }

  const coords = {
    repoRoot,
    childArgs: args,
    workspaceId: scope.projectId,
    domain: endpoint,
    env: scope.env,
  };
  if (options.envs.production.includes(scope.env)) {
    return runInfisicalFirst(coords);
  }
  return runOfflineFirst({
    ...coords,
    configStore: options.configStore,
    allEnvs: options.envs.all,
    nowMs,
    nowIso,
  });
}
