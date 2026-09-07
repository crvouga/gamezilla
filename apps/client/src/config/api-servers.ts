import { APP_IDENTITY } from '@libs/auth/public/app-identity';
import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/public/local-api-origin';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/public/local-preview-api-origin';
import { assert } from '@pkgs/assert';

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

/** Vite sets `import.meta.env.DEV === true` only in development builds. */
function isViteDevelopmentBundle(): boolean {
  const env = import.meta.env as { DEV?: boolean };
  return env.DEV === true;
}

/** Opt-in escape hatch for rare check / incident tooling (must be explicit `1`). */
export function productionApiUrlTigerExceptionEnabled(): boolean {
  const env = import.meta.env as { VITE_ALLOW_PRODUCTION_API_URL?: string };
  return env.VITE_ALLOW_PRODUCTION_API_URL === '1';
}

/**
 * Tiger invariant: block production API origin in local / dev contexts unless
 * {@link productionApiUrlTigerExceptionEnabled}.
 *
 * - `forbid-prod-on-this-machine`: any process (e.g. `setup-env.ts` writing `.env.local`).
 * - `forbid-prod-in-dev-bundle`: only when `DEV` is true (shipped production bundles exempt).
 */
export function assertTigerPolicyForResolvedApiOrigin(
  origin: string,
  policy: 'forbid-prod-on-this-machine' | 'forbid-prod-in-dev-bundle'
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
    policy === 'forbid-prod-in-dev-bundle' &&
    !isViteDevelopmentBundle()
  ) {
    return;
  }

  assert.fail(
    'Tiger invariant: local / development client must not use production API. ' +
      'Set `VITE_API_URL` / `API_URL` to a non-production origin, ' +
      'or set env / secret store `VITE_LOCAL_PREVIEW_API_ORIGIN`, or rely on the default ' +
      `local preview (${DEFAULT_LOCAL_PREVIEW_API_ORIGIN}). ` +
      'If you intentionally need prod from a dev shell or bundle, set VITE_ALLOW_PRODUCTION_API_URL=1.',
    { origin, hostname, policy }
  );
}

function coerceDevBundleApiOrigin(origin: string): string {
  if (!isViteDevelopmentBundle()) return origin;
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

function readViteApiUrlOrigin(): string {
  const env = import.meta.env as { VITE_API_URL?: string };
  const raw = env.VITE_API_URL;
  assert.nonEmptyString(
    raw,
    'VITE_API_URL is required; run `bun run dev` (with secret store) or set apps/client/.env.local'
  );
  let origin = '';
  assert.notThrows(
    () => {
      origin = new URL(raw).origin;
    },
    'VITE_API_URL must be a valid absolute URL',
    { raw }
  );
  origin = coerceDevBundleApiOrigin(origin);
  origin = normalizeLoopbackOriginToLocalhost(origin);
  assertTigerPolicyForResolvedApiOrigin(
    origin,
    'forbid-prod-in-dev-bundle'
  );
  return origin;
}

/**
 * Resolves the API base URL. Production web uses the inlined `VITE_API_URL`
 * (`https://api.gamezilla.app`) — the SPA is on a separate origin from the API
 * Worker.
 */
export function getServerBaseUrl(): string {
  return readViteApiUrlOrigin();
}
