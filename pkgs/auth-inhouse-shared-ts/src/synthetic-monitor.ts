/**
 * Caller side of the hidden synthetic-monitor sign-in (server side:
 * `server/synthetic-monitor.ts`). The runner trades its secret for a one-time
 * `/sso-callback?code=` URL and hands only that URL to the browser.
 */

import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

/** Route under the auth app: `POST <prefix>/auth/synthetic-monitor/code`. */
export const SYNTHETIC_MONITOR_CODE_PATH = '/auth/synthetic-monitor/code';

export type SyntheticMonitorSignInArgs = {
  readonly http: HttpClient;
  /** API origin, e.g. `https://api.example.com`. */
  readonly apiOrigin: string;
  /** Path the auth app is mounted under (`/api` in the product). */
  readonly apiPathPrefix: string;
  readonly token: string;
  readonly peer?: boolean;
  /** Server-issued capability for another device in this journey; omit for a fresh journey. */
  readonly continuationToken?: string;
  /** Trusted web callback, e.g. `https://www.example.com/sso-callback`. */
  readonly callbackUrl: string;
};

export type SyntheticMonitorSignIn = {
  readonly redirectUrl: string;
  readonly continuationToken: string;
};

/** Issue a browser callback and keep its device-continuation capability in the runner. */
export async function requestSyntheticMonitorSignIn(
  args: SyntheticMonitorSignInArgs
): Promise<SyntheticMonitorSignIn> {
  const origin = args.apiOrigin.replace(/\/$/, '');
  const prefix = args.apiPathPrefix.replace(/\/$/, '');
  const url = `${origin}${prefix}${SYNTHETIC_MONITOR_CODE_PATH}`;
  const res = await args.http.fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${args.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      callbackUrl: args.callbackUrl,
      ...(args.peer === true ? { peer: true } : {}),
      ...(args.continuationToken === undefined
        ? {}
        : { continuationToken: args.continuationToken }),
    }),
  });
  const body: unknown = await res.json().catch(() => null);
  const redirectUrl =
    body !== null && typeof body === 'object'
      ? (body as Record<string, unknown>)['redirectUrl']
      : undefined;
  const continuationToken =
    body !== null && typeof body === 'object'
      ? (body as Record<string, unknown>)['continuationToken']
      : undefined;
  if (
    !res.ok ||
    typeof redirectUrl !== 'string' ||
    typeof continuationToken !== 'string'
  ) {
    throw new Error(
      `synthetic-monitor sign-in refused or incomplete: HTTP ${String(res.status)}`
    );
  }
  return { redirectUrl, continuationToken };
}
