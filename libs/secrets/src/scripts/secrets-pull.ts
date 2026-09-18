/**
 * Online step: export Infisical secrets for `dev` + `prd` into
 * `.cache/secrets/` so `bun check` can run offline-first.
 *
 * Usage: `bun run secrets:pull`
 */

// @io-wall-ok — composition root
import { join } from 'node:path';
import { wallClock } from '@pkgs/clock/wall';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { which } from '@pkgs/os/command';
import { INFISICAL_CLI_BIN } from '@pkgs/secret-provider/impl-infisical/defaults';
import { ensureInfisicalCliConfig } from '@pkgs/secret-provider/impl-infisical/ensure-cli-config';
import {
  canFetchInfisicalSecrets,
  exportInfisicalSecretsMap,
} from '@pkgs/secret-provider/impl-infisical/export-secrets';
import { resolveInfisicalEndpoint } from '@pkgs/secret-provider/impl-infisical/resolve-endpoint';
import {
  SECRETS_CACHE_PREFIX,
  SECRETS_CACHE_TTL_MS,
  type SecretsCacheEnv,
  writeSecretsCacheFingerprint,
  writeSecretsCacheMap,
  writeSecretsCacheMeta,
} from '@pkgs/secret-provider/local-secrets-cache';
import { chmodLocalSecretsCacheFiles } from '@pkgs/secret-provider/wall-chmod-local-secrets-cache';
import { resolveSecretsScope } from '@pkgs/secrets-config';
import { computeCheckSecretsFingerprintFromMaps } from '../shared/secrets/check-secrets-fingerprint';

const REPO_ROOT = join(import.meta.dirname, '../../../..');
const CACHE_ENVS: readonly SecretsCacheEnv[] = ['dev', 'prd'];

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

  const maps: Record<SecretsCacheEnv, ReadonlyMap<string, string>> = {
    dev: new Map(),
    prd: new Map(),
  };

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
    maps[env] = map;
    await writeSecretsCacheMap(configStore, env, map);
    console.log(`secrets:pull: wrote ${env}.json (${String(map.size)} keys)`);
  }

  const fingerprint = computeCheckSecretsFingerprintFromMaps(maps);
  await writeSecretsCacheFingerprint(configStore, fingerprint);
  await writeSecretsCacheMeta(configStore, {
    pulledAt: nowIso,
    projectId: scope.projectId,
    envs: CACHE_ENVS,
  });
  chmodLocalSecretsCacheFiles(REPO_ROOT);

  const ttlHours = SECRETS_CACHE_TTL_MS / (60 * 60 * 1000);
  console.log(
    `secrets:pull: fingerprint=${fingerprint.slice(0, 12)}… ` +
      `meta.pulledAt=${nowIso} (stale warn after ${String(ttlHours)}h)`
  );
  console.log('secrets:pull: done. `bun check` will use the cache offline.');
  return 0;
}

process.exit(await main());
