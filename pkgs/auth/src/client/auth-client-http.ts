import type { HttpFetch } from '@pkgs/http-client';

import type { VerifiedSession } from '../shared/verified-session';

export const AUTH_SSO_CANCELLED_ERROR =
  "Sign-in was cancelled or didn't finish.";
export const AUTH_NETWORK_ERROR = 'Network error during sign-in.';

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
