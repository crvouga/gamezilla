/**
 * API base URL for the Vite web client. `VITE_API_URL` is inlined at build
 * time; production and local preview both set it explicitly (no silent
 * default). Tiger invariant: a development bundle must never target the
 * production API unless `VITE_ALLOW_PRODUCTION_API_URL=1`.
 */

import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/app-config-shared-ts/local-preview-api-origin';
import { apiHost } from '@libs/product-identity-shared-ts/brand-hosts';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';

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
  return hostname === apiHost();
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

function loopbackBrowserOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const origin = new URL(window.location.origin);
  if (
    origin.hostname !== 'localhost' &&
    origin.hostname !== '127.0.0.1' &&
    origin.hostname !== '[::1]'
  ) {
    return null;
  }
  return origin.origin;
}

/**
 * Resolves the API base URL. The SPA is served from a separate origin from the
 * API Worker, so the URL is always absolute.
 */
export function getServerBaseUrl(): string {
  const raw = viteEnv().VITE_API_URL;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    const fallback = loopbackBrowserOrigin();
    assert.nonEmptyString(
      fallback,
      'VITE_API_URL is required outside a loopback browser preview; run `bun run dev` or set apps/client-ts/.env.local'
    );
    return fallback;
  }
  const origin = coerceDevBundleApiOrigin(parseOrigin(raw));
  assert.ok(
    viteEnv().DEV !== true ||
      productionApiUrlTigerExceptionEnabled() ||
      !isProductionApiHostname(new URL(origin).hostname),
    'Tiger invariant: development client must not use the production API',
    { origin }
  );
  return origin;
}
