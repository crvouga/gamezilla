import { assert } from '@gamezilla/lib/assert';

/**
 * Production Worker hostname(s). Development must not target these unless
 * {@link productionApiUrlTigerExceptionEnabled} (Tiger Style: fail loud, never silent drift to prod).
 */
export const PRODUCTION_API_HTTP_HOSTNAMES = ['api.gamezilla.app'] as const;

function isProductionApiHttpHostname(hostname: string): boolean {
  return (PRODUCTION_API_HTTP_HOSTNAMES as readonly string[]).includes(hostname);
}

/** Metro / Expo set `globalThis.__DEV__ === true` only in development bundles. */
function isExpoOrMetroDevelopmentBundle(): boolean {
  const g = globalThis as { __DEV__?: boolean };
  return g.__DEV__ === true;
}

/** Opt-in escape hatch for rare QA / incident tooling (must be explicit `1`). */
export function productionApiUrlTigerExceptionEnabled(): boolean {
  return process.env['EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL'] === '1';
}

/**
 * Tiger invariant: block production API origin in local / dev contexts unless
 * {@link productionApiUrlTigerExceptionEnabled}.
 *
 * - `forbid-prod-on-this-machine`: any process (e.g. `setup-env.ts` writing `.env.local`).
 * - `forbid-prod-in-expo-dev-bundle`: only when `__DEV__` is true (shipped production bundles exempt).
 */
export function assertTigerPolicyForResolvedApiOrigin(
  origin: string,
  policy: 'forbid-prod-on-this-machine' | 'forbid-prod-in-expo-dev-bundle'
): void {
  if (productionApiUrlTigerExceptionEnabled()) return;

  let hostname = '';
  assert.notThrows(
    () => {
      hostname = new URL(origin).hostname;
    },
    'Tiger: API origin must parse as URL',
    { origin }
  );

  if (!isProductionApiHttpHostname(hostname)) return;

  if (
    policy === 'forbid-prod-in-expo-dev-bundle' &&
    !isExpoOrMetroDevelopmentBundle()
  ) {
    return;
  }

  assert.fail(
    'Tiger invariant: local / development client must not use production API. ' +
      'Point EXPO_PUBLIC_API_URL at the local Worker (e.g. http://127.0.0.1:8788). ' +
      'If you intentionally need prod from a dev shell or bundle, set EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL=1.',
    { origin, hostname, policy }
  );
}

export function getApiBaseUrl(): string {
  const raw = process.env['EXPO_PUBLIC_API_URL'];
  assert.nonEmptyString(
    raw,
    'EXPO_PUBLIC_API_URL is required; run `bun run dev` (with Doppler) or set apps/client/.env.local'
  );
  let origin = '';
  assert.notThrows(
    () => {
      origin = new URL(raw).origin;
    },
    'EXPO_PUBLIC_API_URL must be a valid absolute URL',
    { raw }
  );
  assertTigerPolicyForResolvedApiOrigin(
    origin,
    'forbid-prod-in-expo-dev-bundle'
  );
  return origin;
}
