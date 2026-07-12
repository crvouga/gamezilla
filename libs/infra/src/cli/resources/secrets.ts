import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import {
  fetchSecret,
  fetchSecretFrom,
  getSecretMap,
  listSecretNames,
  loadSecretsIntoEnv,
  setSecret,
  setSecretIn,
  validateSecret,
} from '../secrets/secrets';
import { ResourceBase, type InfraContext } from './types';

assert.notThrows(
  () => crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

const productionApiPublicOrigin = (): string =>
  `https://api.${PROJECT_CONFIG.domain}`;

const legacyWwwApiOrigin = (): string =>
  `https://www.${PROJECT_CONFIG.domain}`;

/** Identity-derived origins — always converge to api. (rewrites legacy www). */
const API_ORIGIN_DERIVED_KEYS = new Set(['API_URL', 'EXPO_PUBLIC_API_URL']);

const DERIVED_DEFAULTS: Record<string, () => string> = {
  TURBO_LOG_ORDER: () => 'auto',
  TURBO_TELEMETRY_DISABLED: () => '1',
  TURBO_CACHE: () => 'remote:rw',
  EXPO_PUBLIC_API_URL: productionApiPublicOrigin,
  API_URL: productionApiPublicOrigin,
  EXPO_PUBLIC_POWERSYNC_URL: () => {
    const url = (process.env['POWERSYNC_URL'] ?? '').trim();
    return url.length > 0 ? url : '';
  },
};

const EXTERNALLY_MANAGED_KEYS: ReadonlyArray<string> = [
  'EXPO_PUBLIC_COMMIT_HASH',
  'EXPO_PUBLIC_COMMIT_DATE',
  'EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY',
  'LOCAL_PREVIEW_API_ORIGIN',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PUBLISHABLE_KEY',
  'ELEVEN_LABS_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'POWERSYNC_JWT_PRIVATE_KEY',
];

const SHARED_MIRROR_TO_DEV_KEYS: ReadonlyArray<string> = [
  'TURBO_API',
  'TURBO_TOKEN',
  'TURBO_TEAM',
  'TURBO_CACHE',
  'TURBO_LOG_ORDER',
  'TURBO_TELEMETRY_DISABLED',
  'EXPO_TOKEN',
];

export class SecretsResource extends ResourceBase {
  readonly id = 'secrets';

  async provision(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    this.loadSecrets(platform);
    await this.validateSecrets(platform);
    this.ensureDefaults();
    this.mirrorSharedToDev(platform);
    this.warnOnOrphans(platform);
  }

  async destroy(): Promise<void> {
    ok('Secrets', 'nothing to tear down');
  }

  loadSecretsQuick(): void {
    for (const entry of getSecretMap()) {
      const { secretKey, env } = entry;
      const existing = process.env[env];
      if (typeof existing === 'string' && existing.trim().length > 0) continue;
      try {
        process.env[env] = fetchSecret(secretKey);
      } catch (e) {
        if (entry.optional === true) continue;
        warn(
          env,
          `secret get ${secretKey} failed: ${e instanceof Error ? e.message : String(e)}`
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
      warn(r.env, 'not found in secret store');
      failed++;
    }

    if (loaded > 0) ok('Secrets loaded', String(loaded));
    if (failed > 0) {
      platform.warning(`${failed} secret(s) missing from secret store`);
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
      const value = generate();
      if (value.length === 0) continue;

      const current = (process.env[key] ?? '').trim();
      const shouldRewriteLegacyWww =
        API_ORIGIN_DERIVED_KEYS.has(key) && current === legacyWwwApiOrigin();

      if (current.length > 0 && current === value) continue;
      if (current.length > 0 && !shouldRewriteLegacyWww) continue;

      process.env[key] = value;

      try {
        setSecret(key, value);
        ok(
          key,
          shouldRewriteLegacyWww
            ? 'rewrote legacy www origin → api. in secret store'
            : 'populated in secret store'
        );
      } catch {
        ok(key, 'set in env (secret store save skipped)');
      }
    }
  }

  private mirrorSharedToDev(platform: CiPlatform): void {
    const active = (process.env['SECRETS_ENV'] ?? '').trim();
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
        current = fetchSecretFrom('dev', key);
      } catch {
        current = null;
      }

      if (current === source) {
        skipped++;
        continue;
      }

      try {
        setSecretIn('dev', key, source);
        mirrored++;
      } catch (e) {
        platform.warning(
          `Failed to mirror ${key} from ${active} → dev: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    if (mirrored > 0) {
      ok('Secrets dev mirror', `mirrored ${active} → dev (${mirrored})`);
    } else if (skipped > 0) {
      ok('Secrets dev mirror', `already in sync with dev (${skipped})`);
    }
  }

  private warnOnOrphans(platform: CiPlatform): void {
    let actual: ReadonlyArray<string>;
    try {
      actual = listSecretNames();
    } catch (e) {
      warn('Orphan check', e instanceof Error ? e.message : String(e));
      return;
    }

    const managed = new Set<string>([
      ...getSecretMap().map((s) => s.secretKey),
      ...Object.keys(DERIVED_DEFAULTS),
      ...EXTERNALLY_MANAGED_KEYS,
    ]);

    const orphans = actual.filter((name) => !managed.has(name));
    if (orphans.length === 0) {
      ok('Secrets invariant', 'all secrets are CLI-managed');
      return;
    }

    warn(
      'Secret orphans',
      `${orphans.length} unmanaged secret(s): ${orphans.join(', ')}`
    );
    platform.warning(
      `Secret store has ${orphans.length} secret(s) not owned by the infra CLI: ${orphans.join(', ')}. ` +
        'Register them in DERIVED_DEFAULTS or EXTERNALLY_MANAGED_KEYS, or delete them.'
    );
  }
}
