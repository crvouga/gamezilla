import { assert } from '@gamezilla/lib/assert';
import { PROJECT_CONFIG, turboCachePublicUrl } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import {
  fetchDopplerSecret,
  getSecretMap,
  listDopplerSecretNames,
  loadSecretsIntoEnv,
  setDopplerSecret,
  validateSecret,
} from '../secrets/secrets';
import { ResourceBase, type InfraContext } from './types';

assert.notThrows(
  () => crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

const apiWorkerPublicOrigin = (): string =>
  `https://api.${PROJECT_CONFIG.domain}`;

const DERIVED_DEFAULTS: Record<string, () => string> = {
  TURBO_TOKEN: () => crypto.randomUUID(),
  TURBO_API: () => turboCachePublicUrl(),
  TURBO_TEAM: () => `team_${PROJECT_CONFIG.domain.replace(/\.\w+$/, '')}`,
  TURBO_LOG_ORDER: () => 'stream',
  TURBO_TELEMETRY_DISABLED: () => '1',
  // Force every `turbo` invocation to use the self-hosted remote cache
  // instead of the local filesystem cache. Same syntax as `--cache`.
  TURBO_CACHE: () => 'remote:rw',
  /** Public API Worker origin (same value as EXPO_PUBLIC_API_URL) — required by `stripe:sync` to register the webhook endpoint. */
  API_URL: apiWorkerPublicOrigin,
  // Public API origin baked into the Expo/web client at build time.
  EXPO_PUBLIC_API_URL: apiWorkerPublicOrigin,
};

/**
 * Doppler keys not populated by `DERIVED_DEFAULTS` but still managed elsewhere
 * in the provision DAG. Declared so {@link DopplerResource.warnOnOrphans}
 * recognizes them as managed instead of flagging them stale.
 */
const EXTERNALLY_MANAGED_KEYS: ReadonlyArray<string> = [
  'EXPO_PUBLIC_COMMIT_HASH',
  'LOCAL_PREVIEW_API_ORIGIN',
  'PLANETSCALE_DATABASE',
  'PLANETSCALE_ORG',
  'WEB_CLIENT_GOOGLE_CLIENT_ID',
  'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
];

/** Doppler's built-in config metadata — always present, never user-managed. */
const DOPPLER_RESERVED_KEYS: ReadonlyArray<string> = [
  'DOPPLER_CONFIG',
  'DOPPLER_ENVIRONMENT',
  'DOPPLER_PROJECT',
];

export class DopplerResource extends ResourceBase {
  readonly id = 'doppler';

  async provision(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    this.loadSecrets(platform);
    await this.validateSecrets(platform);
    this.ensureDefaults();
    this.warnOnOrphans(platform);
  }

  async destroy(): Promise<void> {
    ok('Doppler', 'nothing to tear down');
  }

  /**
   * Minimal secret loading for commands that need env vars before the
   * full resource DAG runs (e.g. destroy).
   */
  loadSecretsQuick(): void {
    for (const { secretKey: doppler, env } of getSecretMap()) {
      const existing = process.env[env];
      if (typeof existing === 'string' && existing.trim().length > 0) continue;
      try {
        process.env[env] = fetchDopplerSecret(doppler);
      } catch (e) {
        warn(
          env,
          `Doppler get ${doppler} failed: ${e instanceof Error ? e.message : String(e)}`
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
      } else {
        warn(r.env, 'not found in Doppler');
        failed++;
      }
    }

    if (loaded > 0) ok('Doppler secrets loaded', String(loaded));
    if (failed > 0) {
      platform.warning(`${failed} secret(s) missing from Doppler`);
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
        setDopplerSecret(key, value);
        ok(key, 'populated in Doppler');
      } catch {
        ok(key, 'set in env (Doppler save skipped)');
      }
    }
  }

  /**
   * Invariant: every secret in Doppler is owned by the infra CLI. Flag any
   * key that isn't in the required set, derived defaults, externally-managed
   * list, or Doppler's reserved metadata. Warn-only — deletion requires a
   * human (`infra` doesn't second-guess operator intent).
   */
  private warnOnOrphans(platform: CiPlatform): void {
    let actual: ReadonlyArray<string>;
    try {
      actual = listDopplerSecretNames();
    } catch (e) {
      warn('Doppler orphan check', e instanceof Error ? e.message : String(e));
      return;
    }

    const managed = new Set<string>([
      ...getSecretMap().map((s) => s.secretKey),
      ...Object.keys(DERIVED_DEFAULTS),
      ...EXTERNALLY_MANAGED_KEYS,
      ...DOPPLER_RESERVED_KEYS,
    ]);

    const orphans = actual.filter((name) => !managed.has(name));
    if (orphans.length === 0) {
      ok('Doppler invariant', 'all secrets are CLI-managed');
      return;
    }

    warn(
      'Doppler orphans',
      `${orphans.length} unmanaged secret(s): ${orphans.join(', ')}`
    );
    platform.warning(
      `Doppler has ${orphans.length} secret(s) not owned by the infra CLI: ${orphans.join(', ')}. ` +
        'Either register them in `apps/infra/src/cli/resources/doppler.ts` ' +
        '(DERIVED_DEFAULTS or EXTERNALLY_MANAGED_KEYS) or delete them with ' +
        '`doppler secrets delete <NAME>`.'
    );
  }
}
