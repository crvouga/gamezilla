import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/app-config-shared-ts/local-preview-api-origin';
import { apiHost } from '@libs/product-identity-shared-ts/brand-hosts';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';

/**
 * Production API Worker hostname(s). Development must not target these unless
 * {@link productionApiUrlTigerExceptionEnabled} (Tiger Style: fail loud, never silent drift to prod).
 */
export const PRODUCTION_API_HTTP_HOSTNAMES: readonly string[] = [apiHost()];

function isProductionApiHttpHostname(hostname: string): boolean {
  return PRODUCTION_API_HTTP_HOSTNAMES.includes(hostname);
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

  if (policy === 'forbid-prod-in-dev-bundle' && !isViteDevelopmentBundle()) {
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
    'VITE_API_URL is required; run `bun run dev` (with secret store) or set apps/client-ts/.env.local'
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
  assertTigerPolicyForResolvedApiOrigin(origin, 'forbid-prod-in-dev-bundle');
  return origin;
}

/**
 * Resolves the API base URL. Production web uses the inlined `VITE_API_URL`
 * (`https://api.<domain>`) — the SPA is on a separate origin from the API
 * Worker.
 */
export function getServerBaseUrl(): string {
  return readViteApiUrlOrigin();
}
