import type { BrowserNavigation } from './browser-navigation';
import type { ProductHttp } from './ports';

/** App chrome is absent only at the configured provider's valid OAuth handoff. */
export async function atConfiguredGoogleHandoff(
  browser: BrowserNavigation | undefined,
  http: ProductHttp
): Promise<boolean> {
  if (browser === undefined || http.kind !== 'stack') return false;
  try {
    let url = new URL(await browser.currentUrl());
    const origin = new URL(http.idpOrigins.google).origin;
    for (let hop = 0; hop < 4; hop += 1) {
      if (url.origin !== origin || url.username || url.password) return false;
      if (url.searchParams.has('redirect_uri')) {
        return (
          url.searchParams.get('redirect_uri') ===
            `${new URL(http.origin).origin}/api/auth/callback/google` &&
          url.searchParams.get('response_type') === 'code' &&
          (url.searchParams.get('state') ?? '').length > 0
        );
      }
      const next = url.searchParams.get('continue');
      if (next === null) return false;
      url = new URL(next);
    }
  } catch {
    // An unreadable or malformed location never exempts the app chrome check.
  }
  return false;
}
