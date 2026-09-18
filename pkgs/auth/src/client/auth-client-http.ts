import type { HttpFetch } from '@pkgs/http-client';
import { IDP_PROVIDER_GOOGLE } from '../shared/auth-constants';
import type { VerifiedSession } from '../shared/verified-session';

export const AUTH_SSO_CANCELLED_ERROR =
  "Sign-in was cancelled or didn't finish.";
export const AUTH_SSO_POPUP_BLOCKED_ERROR =
  'Popup window was blocked by the browser or failed to open. This can happen in mobile browsers when the window.open() method was invoked too long after a user input was fired.';
export const AUTH_NETWORK_ERROR = 'Network error during sign-in.';

export type OauthProviderId = typeof IDP_PROVIDER_GOOGLE;

export type SessionBody = {
  readonly token?: string;
  readonly expiresAt?: string;
  readonly user?: {
    readonly id: string;
    readonly email: string | null;
    readonly name: string | null;
  };
};

export function toVerified(body: SessionBody): VerifiedSession | null {
  if (body.user === undefined) return null;
  return {
    externalUserId: body.user.id,
    accountId: null,
    email: body.user.email ?? null,
    expiresAt:
      typeof body.expiresAt === 'string' ? new Date(body.expiresAt) : null,
  };
}

/**
 * IdP Hono app mounts at `/auth/*` under the host `/api` prefix
 * (`createServer` → `.route('/api', …)`).
 */
export function apiUrl(baseURL: string, path: string): string {
  const root = baseURL.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/api/')) {
    return `${root}${normalized}`;
  }
  return `${root}/api${normalized}`;
}

export function buildOauthLaunchUrl(
  baseURL: string,
  provider: OauthProviderId,
  callbackUrl: string
): string {
  const url = new URL(apiUrl(baseURL, '/auth/oauth/launch'));
  url.searchParams.set('provider', provider);
  url.searchParams.set('callbackUrl', callbackUrl);
  return url.toString();
}

export function strategyToOauthProvider(
  _strategy: 'oauth-google'
): OauthProviderId {
  return IDP_PROVIDER_GOOGLE;
}

export function isPopupBlockedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message === AUTH_SSO_POPUP_BLOCKED_ERROR) return true;
  const coded = err as Error & { code?: string };
  return coded.code === 'ERR_WEB_BROWSER_BLOCKED';
}

export async function postJson(
  fetchFn: HttpFetch,
  url: string,
  body: unknown,
  bearer?: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (bearer !== undefined && bearer !== null && bearer.length > 0) {
    headers['authorization'] = `Bearer ${bearer}`;
  }
  return fetchFn(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

export function extractCodeFromCallbackUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    return code !== null && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}
