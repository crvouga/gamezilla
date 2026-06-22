import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import {
  deleteVaultSecret,
  fetchVaultSecret,
  fetchVaultSecretFrom,
  getSecretMap,
  listVaultSecretNames,
  loadSecretsIntoEnv,
  setVaultSecret,
  setVaultSecretIn,
  validateSecret,
} from '../secrets/secrets';
import { ResourceBase, type InfraContext } from './types';

assert.notThrows(
  () => crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

const apiWorkerPublicOrigin = (): string =>
  `https://www.${PROJECT_CONFIG.domain}`;

const DERIVED_DEFAULTS: Record<string, () => string> = {
  TURBO_LOG_ORDER: () => 'auto',
  TURBO_TELEMETRY_DISABLED: () => '1',
  TURBO_CACHE: () => 'remote:rw',
  EXPO_PUBLIC_API_URL: apiWorkerPublicOrigin,
  BETTER_AUTH_SECRET: () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0')
    ).join(''),
};

const EXTERNALLY_MANAGED_KEYS: ReadonlyArray<string> = [
  'EXPO_PUBLIC_COMMIT_HASH',
  'EXPO_PUBLIC_COMMIT_DATE',
  'LOCAL_PREVIEW_API_ORIGIN',
  'PLANETSCALE_DATABASE',
  'PLANETSCALE_SERVICE_TOKEN_ID',
  'PLANETSCALE_SERVICE_TOKEN',
  'STRIPE_WEBHOOK_SECRET',
  'PLANETSCALE_ORG',
  'PLANETSCALE_DATABASE_URL',
  'STRIPE_PUBLISHABLE_KEY',
];

const STALE_KEYS_TO_DELETE: ReadonlyArray<string> = [
  'API_URL',
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
];

const SHARED_TURBO_KEYS: ReadonlyArray<string> = [
  'TURBO_API',
  'TURBO_TOKEN',
  'TURBO_TEAM',
  'TURBO_CACHE',
  'TURBO_LOG_ORDER',
  'TURBO_TELEMETRY_DISABLED',
];

const SHARED_MIRROR_TO_DEV_KEYS: ReadonlyArray<string> = [
  ...SHARED_TURBO_KEYS,
  'EXPO_TOKEN',
];

export class VaultResource extends ResourceBase {
  readonly id = 'vault';

  async provision(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    this.loadSecrets(platform);
    await this.validateSecrets(platform);
    this.ensureDefaults();
    this.mirrorSharedToDev(platform);
    this.cleanupStaleSecrets();
    this.warnOnOrphans(platform);
  }

  async destroy(): Promise<void> {
    ok('Vault', 'nothing to tear down');
  }

  loadSecretsQuick(): void {
    for (const entry of getSecretMap()) {
      const { secretKey, env } = entry;
      const existing = process.env[env];
      if (typeof existing === 'string' && existing.trim().length > 0) continue;
      try {
        process.env[env] = fetchVaultSecret(secretKey);
      } catch (e) {
        if (entry.optional === true) continue;
        warn(
          env,
          `Vault get ${secretKey} failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  private loadSecrets(platform: CiPlatform): void {
    const results = loadSecretsIntoEnv();
    let loaded = 0;
    let failed = 0;

    for (const r of results) {
      if (r.set) {
        loaded++;
        continue;
      }
      if (r.optional) continue;
      warn(r.env, 'not found in Vault');
      failed++;
    }

    if (loaded > 0) ok('Vault secrets loaded', String(loaded));
    if (failed > 0) {
      platform.warning(`${failed} secret(s) missing from Vault`);
    }
  }

  private async validateSecrets(platform: CiPlatform): Promise<void> {
    const secretMap = getSecretMap();
    let validationFailed = false;

    for (const entry of secretMap) {
      const value = process.env[entry.env];
      if (!value) continue;
      const err = await validateSecret(entry, value);
      if (err) {
        platform.error(`${entry.secretKey}: ${err}`);
        validationFailed = true;
      } else {
        ok(entry.secretKey);
      }
    }

    assert.ok(
      !validationFailed,
      'Secret validation failed — fix the issues above before continuing'
    );
  }

  private ensureDefaults(): void {
    for (const [key, generate] of Object.entries(DERIVED_DEFAULTS)) {
      if (process.env[key]) continue;

      const value = generate();
      process.env[key] = value;

      try {
        setVaultSecret(key, value);
        ok(key, 'populated in Vault');
      } catch {
        ok(key, 'set in env (Vault save skipped)');
      }
    }
  }

  private mirrorSharedToDev(platform: CiPlatform): void {
    const active = (process.env['VAULT_CONFIG'] ?? '').trim();
    if (active === '' || active === 'dev') {
      return;
    }

    let mirrored = 0;
    let skipped = 0;
    for (const key of SHARED_MIRROR_TO_DEV_KEYS) {
      const source = process.env[key];
      if (typeof source !== 'string' || source.length === 0) continue;

      let current: string | null = null;
      try {
        current = fetchVaultSecretFrom('dev', key);
      } catch {
        current = null;
      }

      if (current === source) {
        skipped++;
        continue;
      }

      try {
        setVaultSecretIn('dev', key, source);
        mirrored++;
      } catch (e) {
        platform.warning(
          `Failed to mirror ${key} from ${active} → dev: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    if (mirrored > 0) {
      ok('Vault dev mirror', `mirrored ${active} → dev (${mirrored})`);
    } else if (skipped > 0) {
      ok('Vault dev mirror', `already in sync with dev (${skipped})`);
    }
  }

  private cleanupStaleSecrets(): void {
    if (STALE_KEYS_TO_DELETE.length === 0) return;
    let present: ReadonlyArray<string>;
    try {
      present = listVaultSecretNames();
    } catch (e) {
      warn(
        'Vault stale-key cleanup',
        e instanceof Error ? e.message : String(e)
      );
      return;
    }
    const presentSet = new Set(present);
    for (const key of STALE_KEYS_TO_DELETE) {
      if (!presentSet.has(key)) continue;
      try {
        deleteVaultSecret(key);
        ok(key, 'deleted (stale — removed integration)');
      } catch (e) {
        warn(
          key,
          `delete failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  private warnOnOrphans(platform: CiPlatform): void {
    let actual: ReadonlyArray<string>;
    try {
      actual = listVaultSecretNames();
    } catch (e) {
      warn('Vault orphan check', e instanceof Error ? e.message : String(e));
      return;
    }

    const managed = new Set<string>([
      ...getSecretMap().map((s) => s.secretKey),
      ...Object.keys(DERIVED_DEFAULTS),
      ...EXTERNALLY_MANAGED_KEYS,
    ]);

    const orphans = actual.filter((name) => !managed.has(name));
    if (orphans.length === 0) {
      ok('Vault invariant', 'all secrets are CLI-managed');
      return;
    }

    warn(
      'Vault orphans',
      `${orphans.length} unmanaged secret(s): ${orphans.join(', ')}`
    );
    platform.warning(
      `Vault has ${orphans.length} secret(s) not owned by the infra CLI: ${orphans.join(', ')}. ` +
        'Either register them in `libs/infra/src/cli/resources/vault.ts` ' +
        '(DERIVED_DEFAULTS or EXTERNALLY_MANAGED_KEYS) or delete them with ' +
        '`vault kv patch -mount=secret -delete=<NAME> personal/<config>`.'
    );
  }
}
