/**
 * Caller side of the hidden synthetic-monitor sign-in (server side:
 * `server/synthetic-monitor.ts`). The runner trades its secret for a one-time
 * `/sso-callback?code=` URL and hands only that URL to the browser.
 */

import type { HttpClient } from '@pkgs/http-client';

/** Route under the auth app: `POST <prefix>/auth/synthetic-monitor/code`. */
export const SYNTHETIC_MONITOR_CODE_PATH = '/auth/synthetic-monitor/code';

export type SyntheticMonitorRedirectArgs = {
  readonly http: HttpClient;
  /** API origin, e.g. `https://api.example.com`. */
  readonly apiOrigin: string;
  /** Path the auth app is mounted under (`/api` in the product). */
  readonly apiPathPrefix: string;
  readonly token: string;
  /** Trusted web callback, e.g. `https://www.example.com/sso-callback`. */
  readonly callbackUrl: string;
};

/** Resolve the `<callbackUrl>?code=…` a browser loads to finish sign-in. */
export async function requestSyntheticMonitorRedirect(
  args: SyntheticMonitorRedirectArgs
): Promise<string> {
  const origin = args.apiOrigin.replace(/\/$/, '');
  const prefix = args.apiPathPrefix.replace(/\/$/, '');
  const url = `${origin}${prefix}${SYNTHETIC_MONITOR_CODE_PATH}`;
  const res = await args.http.fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${args.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ callbackUrl: args.callbackUrl }),
  });
  const body: unknown = await res.json().catch(() => null);
  const redirectUrl =
    body !== null && typeof body === 'object'
      ? (body as Record<string, unknown>)['redirectUrl']
      : undefined;
  if (!res.ok || typeof redirectUrl !== 'string') {
    throw new Error(
      `synthetic-monitor sign-in refused: HTTP ${String(res.status)} ${JSON.stringify(body)}`
    );
  }
  return redirectUrl;
}
