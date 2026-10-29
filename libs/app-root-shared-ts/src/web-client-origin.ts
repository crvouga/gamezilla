import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';

/**
 * Browser app origin for OAuth return URLs.
 *
 * Better Auth may redirect to a relative `callbackURL` (e.g. `/sso-callback`).
 * Browsers resolve that against the API host — which has no SPA route — so we
 * rewrite those Locations to this origin.
 */
export function resolveWebClientOrigin(apiBaseURL: string): string {
  const trimmed = apiBaseURL.trim().replace(/\/$/, '');
  const api = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  if (api.hostname === 'localhost' || api.hostname === '127.0.0.1') {
    return 'http://localhost:5173';
  }
  if (api.hostname.startsWith('api.')) {
    return `${api.protocol}//www.${api.hostname.slice('api.'.length)}`;
  }
  return `${api.protocol}//www.${api.hostname}`;
}

/** Turn a relative Location into an absolute web-app URL; leave others alone. */
export function absolutizeWebAppLocation(
  location: string,
  webClientOrigin: string
): string {
  const trimmed = location.trim();
  if (trimmed.length === 0) return trimmed;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith(`${PRODUCT.external.deepLinkScheme}:`) ||
    trimmed.startsWith('exp:')
  ) {
    return trimmed;
  }
  if (!trimmed.startsWith('/')) return trimmed;
  return `${webClientOrigin.replace(/\/$/, '')}${trimmed}`;
}
