import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/shared/local-api-origin';
import { assert } from '@pkgs/assert';
import { APP_IDENTITY } from '@libs/auth/shared/app-identity';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/shared/local-preview-api-origin';

export { DEFAULT_LOCAL_PREVIEW_API_ORIGIN };

/**
 * Production API Worker hostname(s). Development must not target these unless
 * {@link productionApiUrlTigerExceptionEnabled} (Tiger Style: fail loud, never silent drift to prod).
 */
export const PRODUCTION_API_HTTP_HOSTNAMES = [APP_IDENTITY.apiHost] as const;

function isProductionApiHttpHostname(hostname: string): boolean {
  return (PRODUCTION_API_HTTP_HOSTNAMES as readonly string[]).includes(
    hostname
  );
}

/** Metro / Expo set `globalThis.__DEV__ === true` only in development bundles. */
function isExpoOrMetroDevelopmentBundle(): boolean {
  return Reflect.get(globalThis, '__DEV__') === true;
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
      'Set `EXPO_PUBLIC_API_URL` / `API_URL` to a non-production origin, ' +
      'or set env / secret store `LOCAL_PREVIEW_API_ORIGIN`, or rely on the default ' +
      `local preview (${DEFAULT_LOCAL_PREVIEW_API_ORIGIN}). ` +
      'If you intentionally need prod from a dev shell or bundle, set EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL=1.',
    { origin, hostname, policy }
  );
}

function coerceDevBundleApiOrigin(origin: string): string {
  if (!isExpoOrMetroDevelopmentBundle()) return origin;
  if (productionApiUrlTigerExceptionEnabled()) return origin;
  let hostname = '';
  assert.notThrows(
    () => {
      hostname = new URL(origin).hostname;
    },
    'API origin must parse as URL',
    { origin }
  );
  if (!isProductionApiHttpHostname(hostname)) return origin;
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

function readExpoPublicApiUrlOrigin(): string {
  // Direct read — Expo inlines `EXPO_PUBLIC_*` at bundle time (see
  // `app-metadata.ts`). Do not nullish-coalesce to a production default in
  // this expression or Metro constant-folds past the env read when `__DEV__`
  // is false (qa preview / `expo export -p web` then bakes api.gamezilla.app
  // even when `EXPO_PUBLIC_API_URL` is set for the Playwright webServer).
  // eslint-disable-next-line expo/no-dynamic-env-var -- `noPropertyAccessFromIndexSignature` requires bracket `process.env` access; Expo still inlines `EXPO_PUBLIC_*`.
  const raw = process.env['EXPO_PUBLIC_API_URL'];
  assert.nonEmptyString(
    raw,
    'EXPO_PUBLIC_API_URL is required; run `bun run dev` (with secret store), set apps/client/.env.local, or export EXPO_PUBLIC_API_URL (and EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL=1 for Expo Go OTA) before `eas update`'
  );
  let origin = '';
  assert.notThrows(
    () => {
      origin = new URL(raw).origin;
    },
    'EXPO_PUBLIC_API_URL must be a valid absolute URL',
    { raw }
  );
  origin = coerceDevBundleApiOrigin(origin);
  origin = normalizeLoopbackOriginToLocalhost(origin);
  assertTigerPolicyForResolvedApiOrigin(
    origin,
    'forbid-prod-in-expo-dev-bundle'
  );
  return origin;
}

/**
 * Resolves the API base URL. Production web and native both use the inlined
 * `EXPO_PUBLIC_API_URL` (`https://api.gamezilla.app`) — the SPA is on a
 * separate origin from the API Worker.
 */
export function getApiBaseUrl(): string {
  return readExpoPublicApiUrlOrigin();
}
