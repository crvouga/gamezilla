#!/usr/bin/env bun
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { ensureObjectStoreBuckets } from '@libs/object-store/shared/ensure-buckets';
// @io-wall-ok
import { assert } from '@pkgs/assert';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';
import { ok, warn } from '../shared/fmt';
import {
  applySeededS3ToEnv,
  clearS3SecretSeedCache,
  seedObjectStoreS3ForEnv,
} from '../shared/s3-secret-seed';
import {
  getMirrorToDevSecrets,
  getRegistrySecretNames,
  getSeedableSecrets,
  SECRETS,
} from '../shared/secrets/registry';
import {
  activeSecretsEnv,
  SECRETS_ENVS,
  type SecretsEnv,
  validateSecretOrError,
} from '../shared/secrets/secret';
import {
  deleteSecretIn,
  ensureSeedInAllEnvsSecrets,
  exportSecretsMapLive,
  fetchSecretFrom,
  listSecretNamesLive,
  loadSecretsIntoEnv,
  setSecret,
  setSecretIn,
} from '../shared/secrets/secrets';

const log = createLogger({ name: 'secrets:provision', now: wallClock.now });

const legacyWwwApiOrigin = (): string => `https://www.${PRODUCT_CONFIG.domain}`;

/**
 * IdP rename: BETTER_AUTH_SECRET → AUTH_SECRET.
 * Allowlisted for better-auth vocabulary (legacy secret name only).
 * Copy before orphan purge drops the legacy key; leave missing envs for
 * seedInAllEnvs.
 */
async function migrateAuthSecretRenameInAllEnvs(): Promise<void> {
  const active = activeSecretsEnv();
  const legacyName = 'BETTER_AUTH_SECRET';

  for (const env of SECRETS_ENVS) {
    const stored = await exportSecretsMapLive(env);
    const current = (stored.get('AUTH_SECRET') ?? '').trim();
    if (current.length > 0) continue;

    const legacy = (stored.get(legacyName) ?? '').trim();
    if (legacy.length === 0) continue;

    try {
      await setSecretIn(env, 'AUTH_SECRET', legacy);
      if (env === active) {
        process.env['AUTH_SECRET'] = legacy;
      }
      ok('AUTH_SECRET', `renamed from ${legacyName} in secrets env ${env}`);
    } catch (e) {
      console.warn(
        `AUTH_SECRET rename (${env}) failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

async function loadSecrets(): Promise<void> {
  const results = await loadSecretsIntoEnv();
  let loaded = 0;
  let failed = 0;

  for (const r of results) {
    if (r.set) {
      loaded++;
      continue;
    }
    if (r.optional) continue;
    warn(r.env, 'not found in secret store');
    failed++;
  }

  if (loaded > 0) ok('Secrets loaded', String(loaded));
  if (failed > 0) {
    console.warn(`${failed} secret(s) missing from secret store`);
  }
}

async function seedSecrets(): Promise<void> {
  clearS3SecretSeedCache();
  const active = activeSecretsEnv();

  try {
    await ensureObjectStoreBuckets();
    ok('R2 buckets', 'ensured (dev + prd)');
  } catch (e) {
    console.warn(
      `R2 bucket ensure failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  for (const env of SECRETS_ENVS) {
    const stored = await exportSecretsMapLive(env);
    try {
      const seeded = await seedObjectStoreS3ForEnv(env, stored);
      if (env === active) applySeededS3ToEnv(seeded);
      ok('S3 secrets', `${env} → ${seeded.bucket}`);
    } catch (e) {
      console.warn(
        `S3 seed (${env}) failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  await migrateAuthSecretRenameInAllEnvs();

  try {
    const seededAllEnvs = await ensureSeedInAllEnvsSecrets();
    for (const r of seededAllEnvs) {
      if (r.action === 'seeded') {
        ok(r.name, `seeded in secrets env ${r.env}`);
      }
    }
  } catch (e) {
    console.warn(
      `seedInAllEnvs failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const storedActive = new Map(await exportSecretsMapLive(active));
  for (const entry of getSeedableSecrets()) {
    if (entry.name.startsWith('S3_')) {
      continue;
    }
    if (entry.seedInAllEnvs) {
      continue;
    }
    const current = (storedActive.get(entry.name) ?? '').trim();
    const shouldRewriteLegacyWww =
      (entry.name === 'API_URL' || entry.name === 'VITE_API_URL') &&
      current === legacyWwwApiOrigin();

    if (current.length > 0 && !shouldRewriteLegacyWww) continue;
    if (entry.seed === undefined) continue;

    try {
      const value = await entry.seed({ env: active, secrets: storedActive });
      if (value.trim().length === 0) continue;
      await setSecret(entry.name, value);
      process.env[entry.name] = value;
      storedActive.set(entry.name, value);
      ok(
        entry.name,
        shouldRewriteLegacyWww
          ? 'rewrote legacy www origin → api. in secret store'
          : 'seeded in secret store'
      );
    } catch (e) {
      console.warn(
        `Seed ${entry.name} failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

async function validateSecrets(): Promise<void> {
  const active = activeSecretsEnv();
  const secrets = await exportSecretsMapLive(active);
  let validationFailed = false;

  for (const entry of SECRETS) {
    const value = secrets.get(entry.name) ?? process.env[entry.name];
    if (value === undefined || value.trim().length === 0) {
      if (!entry.optional) {
        console.error(`${entry.name}: missing`);
        validationFailed = true;
      }
      continue;
    }
    const err = await validateSecretOrError(entry, {
      env: active,
      secretValue: value,
      secrets,
    });
    if (err) {
      console.error(`${entry.name}: ${err}`);
      validationFailed = true;
    } else {
      ok(entry.name);
    }
  }

  assert.ok(
    !validationFailed,
    'Secret validation failed — fix the issues above before continuing'
  );
}

async function mirrorSharedToDev(): Promise<void> {
  const active = (process.env['SECRETS_ENV'] ?? '').trim();
  if (active === '' || active === 'dev') return;

  let mirrored = 0;
  let skipped = 0;
  for (const entry of getMirrorToDevSecrets()) {
    const source = process.env[entry.name];
    if (typeof source !== 'string' || source.length === 0) continue;

    let current: string | null = null;
    try {
      current = await fetchSecretFrom('dev', entry.name);
    } catch {
      current = null;
    }

    if (current === source) {
      skipped++;
      continue;
    }

    try {
      await setSecretIn('dev', entry.name, source);
      mirrored++;
    } catch (e) {
      console.warn(
        `Failed to mirror ${entry.name} from ${active} → dev: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  if (mirrored > 0) {
    ok('Secrets dev mirror', `mirrored ${active} → dev (${mirrored})`);
  } else if (skipped > 0) {
    ok('Secrets dev mirror', `already in sync with dev (${skipped})`);
  }
}

async function purgeOrphansInEnv(
  env: SecretsEnv,
  managed: ReadonlySet<string>
): Promise<void> {
  let actual: ReadonlyArray<string>;
  try {
    actual = await listSecretNamesLive(env);
  } catch (e) {
    warn(`Orphan purge (${env})`, e instanceof Error ? e.message : String(e));
    return;
  }

  const orphans = actual.filter((name) => !managed.has(name));
  if (orphans.length === 0) {
    ok('Secrets invariant', `${env}: all secrets are registry-managed`);
    return;
  }

  console.warn(
    `Purging ${orphans.length} orphan secret(s) from ${env}: ${orphans.join(', ')}`
  );
  for (const name of orphans) {
    try {
      await deleteSecretIn(env, name);
      ok('Purged orphan', `${env}/${name}`);
    } catch (e) {
      console.warn(
        `Failed to purge ${env}/${name}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

async function purgeOrphans(): Promise<void> {
  const managed = getRegistrySecretNames();
  for (const env of SECRETS_ENVS) {
    await purgeOrphansInEnv(env, managed);
  }
}

if (!isProductionSecretsEnv()) {
  log.info('[secrets:provision] dry-run (SECRETS_ENV is not prd)');
  process.exit(0);
}

await loadSecrets();
await seedSecrets();
await validateSecrets();
await mirrorSharedToDev();
await purgeOrphans();
