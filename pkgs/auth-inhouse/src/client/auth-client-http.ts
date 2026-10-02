import type { OauthProviderId, VerifiedSession } from '@pkgs/auth/shared';
import type { HttpFetch } from '@pkgs/http-client';

export const AUTH_SSO_CANCELLED_ERROR =
  "Sign-in was cancelled or didn't finish.";
export const AUTH_SSO_POPUP_BLOCKED_ERROR =
  'Popup window was blocked by the browser or failed to open. This can happen in mobile browsers when the window.open() method was invoked too long after a user input was fired.';
export const AUTH_NETWORK_ERROR = 'Network error during sign-in.';

export type SessionBody = {
  readonly token?: string;
  readonly expiresAt?: string;
  readonly authenticatedAt?: string;
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
    authenticatedAt:
      typeof body.authenticatedAt === 'string'
        ? new Date(body.authenticatedAt)
        : null,
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

export function buildOauthLaunchUrl(args: {
  readonly baseURL: string;
  readonly provider: OauthProviderId;
  readonly callbackUrl: string;
  /** Link to the signed-in account (a ticket from `POST /auth/link/ticket`). */
  readonly linkTicket?: string | undefined;
  /** Finish a pending link by proving the matched account. */
  readonly pendingLink?: string | undefined;
}): string {
  const url = new URL(apiUrl(args.baseURL, '/auth/oauth/launch'));
  url.searchParams.set('provider', args.provider);
  url.searchParams.set('callbackUrl', args.callbackUrl);
  if (args.linkTicket !== undefined) {
    url.searchParams.set('linkTicket', args.linkTicket);
  }
  if (args.pendingLink !== undefined) {
    url.searchParams.set('pendingLink', args.pendingLink);
  }
  return url.toString();
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
