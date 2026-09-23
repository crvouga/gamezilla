/**
 * E2E-bundle (`VITE_E2E=1`) `OpenAuthSession`: Bun.WebView has no popups, so
 * the Dev IdP chooser is handed to the test harness on the web origin, which
 * completes it for the actor that sent the request. The harness echoes the
 * Dev IdP subject, which doubles as the actor's signup username — the same
 * handoff the in-process sim client env makes.
 */

import { setPendingSignupUsername } from '@libs/auth/public/pending-signup-username';
import type { HttpFetch } from '@pkgs/http-client/types';

import type { OpenAuthSession, OpenAuthSessionResult } from './client-env';

const DEV_AUTH_SESSION_PATH = '/api/__sim/auth-session';

type HarnessAuthSessionResult = OpenAuthSessionResult & {
  readonly subject?: string;
};

export function createE2eOpenAuthSession(
  http: HttpFetch,
  harnessOrigin: string
): OpenAuthSession {
  return async (authorizationUrl, callbackUrl) => {
    const response = await http(`${harnessOrigin}${DEV_AUTH_SESSION_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ authorizationUrl, callbackUrl }),
    });
    if (!response.ok) {
      throw new Error(`auth session failed: ${String(response.status)}`);
    }
    const { subject, ...result } =
      (await response.json()) as HarnessAuthSessionResult;
    if (result.type === 'success' && subject !== undefined) {
      setPendingSignupUsername(subject);
    }
    return result;
  };
}
