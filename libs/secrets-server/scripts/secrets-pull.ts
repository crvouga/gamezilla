/**
 * Online step: export Infisical secrets for every environment (one per
 * `libs/infra-shared/tofu/envs/<env>.tfvars.json`) into `.cache/secrets/` so
 * `bun verify` can run offline-first.
 *
 * Usage: `bun run secrets:pull`
 */

// @io-wall-ok — composition root
import { join } from 'node:path';
import { REPO_SECRETS_ENVS } from '@libs/secrets-shared/secrets-envs';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server/repo-tree-store';
import { which } from '@pkgs/os-server/command';
import { ensureInfisicalCliConfig } from '@pkgs/secret-provider-server/ensure-cli-config';
import {
  canFetchInfisicalSecrets,
  exportInfisicalSecretsMap,
} from '@pkgs/secret-provider-server/export-secrets';
import { chmodLocalSecretsCacheFiles } from '@pkgs/secret-provider-server/wall-chmod-local-secrets-cache';
import { INFISICAL_CLI_BIN } from '@pkgs/secret-provider-shared/defaults';
import {
  SECRETS_CACHE_PREFIX,
  SECRETS_CACHE_TTL_MS,
  writeSecretsCacheMap,
  writeSecretsCacheMeta,
} from '@pkgs/secret-provider-shared/local-secrets-cache';
import { resolveInfisicalEndpoint } from '@pkgs/secret-provider-shared/resolve-endpoint';
import { resolveSecretsScope } from '@pkgs/secrets-config-server/secrets-scope';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const CACHE_ENVS = REPO_SECRETS_ENVS.all;

async function main(): Promise<number> {
  if (!which(INFISICAL_CLI_BIN)) {
    console.error(
      `secrets:pull: ${INFISICAL_CLI_BIN} CLI not found on PATH. Install Infisical then retry.`
    );
    return 1;
  }

  const clock = wallClock;
  const nowMs = clock.now();
  const nowIso = new Date(nowMs).toISOString();
  const configStore = createRepoTreeObjectStore({ rootDir: REPO_ROOT });
  const scope = await resolveSecretsScope(configStore);
  await ensureInfisicalCliConfig(configStore, scope);
  const domain = resolveInfisicalEndpoint(scope);

  console.log(
    `secrets:pull: projectId=${scope.projectId} endpoint=${domain} → ${SECRETS_CACHE_PREFIX}/`
  );

  for (const env of CACHE_ENVS) {
    const coords = {
      repoRoot: REPO_ROOT,
      workspaceId: scope.projectId,
      env,
      domain,
    };
    if (!canFetchInfisicalSecrets(coords)) {
      console.error(
        `secrets:pull: Infisical export failed for env=${env}. ` +
          'Run `infisical login` and retry.'
      );
      return 1;
    }
    const map = exportInfisicalSecretsMap(coords);
    await writeSecretsCacheMap(configStore, env, map);
    console.log(`secrets:pull: wrote ${env}.json (${String(map.size)} keys)`);
  }

  await writeSecretsCacheMeta(configStore, {
    pulledAt: nowIso,
    projectId: scope.projectId,
    envs: CACHE_ENVS,
  });
  chmodLocalSecretsCacheFiles(REPO_ROOT, CACHE_ENVS);

  const ttlHours = SECRETS_CACHE_TTL_MS / (60 * 60 * 1000);
  console.log(
    `secrets:pull: meta.pulledAt=${nowIso} (stale warn after ${String(ttlHours)}h)`
  );
  console.log('secrets:pull: done. `bun verify` will use the cache offline.');
  return 0;
}

process.exit(await main());
