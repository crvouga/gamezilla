import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import {
  deleteDopplerSecret,
  fetchDopplerSecret,
  fetchDopplerSecretFrom,
  getSecretMap,
  listDopplerSecretNames,
  loadSecretsIntoEnv,
  setDopplerSecret,
  setDopplerSecretIn,
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
  // Vercel Remote Cache config. `TURBO_TOKEN` and `TURBO_TEAM` are real
  // Vercel credentials and must be supplied by an operator (registered
  // in `SECRET_MAP`); only the universally-safe knobs get derived here.
  TURBO_LOG_ORDER: () => 'auto',
  TURBO_TELEMETRY_DISABLED: () => '1',
  // Force every `turbo` invocation to use the remote cache instead of
  // the local filesystem cache. Same syntax as `--cache`.
  TURBO_CACHE: () => 'remote:rw',
  /** Public API Worker origin (same value as EXPO_PUBLIC_API_URL) — required by `stripe:sync` to register the webhook endpoint. */
  API_URL: apiWorkerPublicOrigin,
  // Public API origin baked into the Expo/web client at build time.
  EXPO_PUBLIC_API_URL: apiWorkerPublicOrigin,
  /**
   * Better Auth signing secret — generated when absent so Workers can boot
   * without a manual `openssl` step (stored only in Doppler).
   */
  BETTER_AUTH_SECRET: () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0')
    ).join(''),
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
  'STRIPE_WEBHOOK_SECRET',
  'PLANETSCALE_ORG',
  // Auto-populated by the Doppler ↔ Planetscale integration alongside
  // PLANETSCALE_DATABASE / PLANETSCALE_ORG. Not consumed by the infra CLI
  // (we connect via PLANETSCALE_SERVICE_TOKEN_* + DB_URL), but kept so the
  // integration sync doesn't fight the orphan check.
  'PLANETSCALE_DATABASE_URL',
  // Stripe publishable key (pk_…) mirrored from the Stripe Dashboard.
  // Not yet wired into the client; reserved for the eventual Stripe.js /
  // Checkout-Elements integration. Acknowledge it here so it stops
  // tripping the orphan check.
  'STRIPE_PUBLISHABLE_KEY',
];

/** Doppler's built-in config metadata — always present, never user-managed. */
const DOPPLER_RESERVED_KEYS: ReadonlyArray<string> = [
  'DOPPLER_CONFIG',
  'DOPPLER_ENVIRONMENT',
  'DOPPLER_PROJECT',
];

/**
 * Doppler keys from removed integrations that should be hard-deleted on every
 * provision. Adding a key here is an explicit, reviewed decision: the orphan
 * check would otherwise warn about them indefinitely. Listed values:
 *
 * - `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`: leftovers from when the API
 *   used Clerk for auth before the Better Auth migration. No code references
 *   them anymore.
 * - `TURBO_API`: pointed at the destroyed self-hosted Cloudflare Turbo
 *   cache Worker. Vercel Remote Cache discovers its endpoint from
 *   `TURBO_TOKEN` so this key has no consumer; `TurboCacheWorkerResource.destroy`
 *   also clears it eagerly during the deploy's `'destroyed'`-resource
 *   tail phase.
 */
const STALE_KEYS_TO_DELETE: ReadonlyArray<string> = [
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'TURBO_API',
];

/**
 * Vercel Remote Cache config that must be identical between the active
 * Doppler config and `dev` so `bun run check:ci` (which reads `dev`)
 * sees the same Vercel team + token that production rotates from. The
 * mirror runs unconditionally after defaults are populated so drift is
 * structurally impossible.
 */
const SHARED_TURBO_KEYS: ReadonlyArray<string> = [
  'TURBO_TOKEN',
  'TURBO_TEAM',
  'TURBO_CACHE',
  'TURBO_LOG_ORDER',
  'TURBO_TELEMETRY_DISABLED',
];

export class DopplerResource extends ResourceBase {
  readonly id = 'doppler';

  async provision(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    this.loadSecrets(platform);
    await this.validateSecrets(platform);
    this.ensureDefaults();
    this.mirrorSharedToDev(platform);
    this.cleanupStaleSecrets();
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
    for (const entry of getSecretMap()) {
      const { secretKey: doppler, env } = entry;
      const existing = process.env[env];
      if (typeof existing === 'string' && existing.trim().length > 0) continue;
      try {
        process.env[env] = fetchDopplerSecret(doppler);
      } catch (e) {
        if (entry.optional === true) continue;
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
        continue;
      }
      // Optional secrets are allowed to be absent; consumers must use
      // `SecretStore.getOptional` and fall back to a sensible default.
      if (r.optional) continue;
      warn(r.env, 'not found in Doppler');
      failed++;
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
   * Invariant: the Vercel Remote Cache config (`TURBO_TOKEN` + friends)
   * must be identical in the active config and `dev`. Vercel
   * authenticates the token via `TURBO_TOKEN`; `bun run check:ci` reads
   * `dev`. If they diverge every cache request 401s, silently
   * destroying CI cache hits. Mirror unconditionally so this is
   * structurally impossible.
   */
  private mirrorSharedToDev(platform: CiPlatform): void {
    const active = (process.env['DOPPLER_CONFIG'] ?? '').trim();
    if (active === '' || active === 'dev') {
      // Nothing to mirror: either we don't know what config is active,
      // or we're already operating on `dev` (no other source to copy
      // from).
      return;
    }

    let mirrored = 0;
    let skipped = 0;
    for (const key of SHARED_TURBO_KEYS) {
      const source = process.env[key];
      if (typeof source !== 'string' || source.length === 0) continue;

      let current: string | null = null;
      try {
        current = fetchDopplerSecretFrom('dev', key);
      } catch {
        current = null;
      }

      if (current === source) {
        skipped++;
        continue;
      }

      try {
        setDopplerSecretIn('dev', key, source);
        mirrored++;
      } catch (e) {
        platform.warning(
          `Failed to mirror ${key} from ${active} → dev: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    if (mirrored > 0) {
      ok(
        'Turbo remote cache secrets',
        `mirrored ${active} → dev (${mirrored})`
      );
    } else if (skipped > 0) {
      ok('Turbo remote cache secrets', `already in sync with dev (${skipped})`);
    }
  }

  /**
   * Hard-delete keys in {@link STALE_KEYS_TO_DELETE} so removed integrations
   * (e.g. Clerk before the Better Auth migration) don't linger in Doppler and
   * trip the orphan check forever. Idempotent: keys that don't exist are a
   * no-op.
   */
  private cleanupStaleSecrets(): void {
    if (STALE_KEYS_TO_DELETE.length === 0) return;
    let present: ReadonlyArray<string>;
    try {
      present = listDopplerSecretNames();
    } catch (e) {
      warn(
        'Doppler stale-key cleanup',
        e instanceof Error ? e.message : String(e)
      );
      return;
    }
    const presentSet = new Set(present);
    for (const key of STALE_KEYS_TO_DELETE) {
      if (!presentSet.has(key)) continue;
      try {
        deleteDopplerSecret(key);
        ok(key, 'deleted (stale — removed integration)');
      } catch (e) {
        warn(
          key,
          `delete failed: ${e instanceof Error ? e.message : String(e)}`
        );
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
        'Either register them in `libs/infra/src/cli/resources/doppler.ts` ' +
        '(DERIVED_DEFAULTS or EXTERNALLY_MANAGED_KEYS) or delete them with ' +
        '`doppler secrets delete <NAME>`.'
    );
  }
}
