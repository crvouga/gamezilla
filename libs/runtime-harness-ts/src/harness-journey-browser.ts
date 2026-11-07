import type { BrowserNavigation } from '@libs/harness-ts/browser-navigation';
import type { ProductHttp } from '@libs/harness-ts/ports';
import type { JourneyBrowser } from './journey-types';

/** A stack declares the real simulator origin and its real HTTP callback boundary. */
export function harnessJourneyBrowser(args: {
  readonly http: ProductHttp;
  readonly navigation: BrowserNavigation | undefined;
}): JourneyBrowser | null {
  if (args.navigation === undefined || args.http.kind !== 'stack') return null;
  return {
    googleAuthorizationOrigin: new URL(args.http.idpOrigins.google).origin,
    oauthCallbackOrigin: new URL(args.http.origin).origin,
    waitForNavigation: args.navigation.waitForNavigation,
  };
}
