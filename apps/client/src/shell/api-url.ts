/**
 * API base URL for the Vite web client. `VITE_API_URL` is inlined at build
 * time; production and local preview both set it explicitly (no silent
 * default). Tiger invariant: a development bundle must never target the
 * production API unless `VITE_ALLOW_PRODUCTION_API_URL=1`.
 */

import { APP_IDENTITY } from '@libs/auth/public/app-identity';
import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/public/local-api-origin';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/public/local-preview-api-origin';
import { assert } from '@pkgs/assert';

type ViteEnv = {
  readonly DEV?: boolean;
  readonly VITE_API_URL?: string;
  readonly VITE_ALLOW_PRODUCTION_API_URL?: string;
};

function viteEnv(): ViteEnv {
  const env: ViteEnv = import.meta.env;
  return env;
}

function isProductionApiHostname(hostname: string): boolean {
  return hostname === APP_IDENTITY.apiHost;
}

export function productionApiUrlTigerExceptionEnabled(): boolean {
  return viteEnv().VITE_ALLOW_PRODUCTION_API_URL === '1';
}

function parseOrigin(raw: string): string {
  let origin = '';
  assert.notThrows(
    () => {
      origin = new URL(raw).origin;
    },
    'VITE_API_URL must be a valid absolute URL',
    { raw }
  );
  return origin;
}

/** Development bundles fall back to the local preview origin instead of prod. */
function coerceDevBundleApiOrigin(origin: string): string {
  if (viteEnv().DEV !== true) return origin;
  if (productionApiUrlTigerExceptionEnabled()) return origin;
  if (!isProductionApiHostname(new URL(origin).hostname)) return origin;
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

/**
 * Resolves the API base URL. The SPA is served from a separate origin from the
 * API Worker, so the URL is always absolute.
 */
export function getServerBaseUrl(): string {
  const raw = viteEnv().VITE_API_URL;
  assert.nonEmptyString(
    raw,
    'VITE_API_URL is required; run `bun start:localhost` from the repository root or set apps/client/.env.local'
  );
  const origin = normalizeLoopbackOriginToLocalhost(
    coerceDevBundleApiOrigin(parseOrigin(raw))
  );
  assert.ok(
    viteEnv().DEV !== true ||
      productionApiUrlTigerExceptionEnabled() ||
      !isProductionApiHostname(new URL(origin).hostname),
    'Tiger invariant: development client must not use the production API',
    { origin }
  );
  return origin;
}
