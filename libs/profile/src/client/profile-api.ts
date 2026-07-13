import { getCachedDeviceId } from '@libs/auth/client/use-device-id';
import { getCachedAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import type { ConfigService } from '@libs/auth/client/config-service-types';

import {
  isProfileError,
  ProfileError,
  type ProfileErrorCode,
} from '../shared/profile-errors';

const X_ANON_ID = 'x-anon-id';

export type ProfileApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function authHeaders(): Record<string, string> {
  const token = getCachedAuthToken();
  const anon = getCachedDeviceId();
  if (token !== null && token.length > 0) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (anon !== null && anon.length > 0) {
      headers[X_ANON_ID] = anon;
    }
    return headers;
  }
  if (anon !== null && anon.length > 0) {
    return { [X_ANON_ID]: anon, 'Content-Type': 'application/json' };
  }
  return { 'Content-Type': 'application/json' };
}

function parseErrorBody(body: string): {
  readonly code: ProfileErrorCode | null;
  readonly message: string;
} {
  try {
    const parsed = JSON.parse(body) as {
      readonly code?: unknown;
      readonly error?: unknown;
    };
    const code =
      typeof parsed.code === 'string'
        ? (parsed.code as ProfileErrorCode)
        : null;
    const message =
      typeof parsed.error === 'string' && parsed.error.length > 0
        ? parsed.error
        : body;
    return { code, message };
  } catch {
    return { code: null, message: body };
  }
}

export async function profileApiFetch(args: {
  readonly config: ConfigService;
  readonly fetchFn: ProfileApiFetch;
  readonly path: string;
  readonly init?: RequestInit;
}): Promise<Response> {
  const url = `${args.config.getApiUrl()}/api${args.path}`;
  return args.fetchFn(url, {
    ...args.init,
    headers: {
      ...authHeaders(),
      ...args.init?.headers,
    },
  });
}

export async function profileApiJson<T>(args: {
  readonly config: ConfigService;
  readonly fetchFn: ProfileApiFetch;
  readonly path: string;
  readonly init?: RequestInit;
}): Promise<T> {
  const res = await profileApiFetch(args);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const parsed = parseErrorBody(body);
    if (parsed.code !== null) {
      throw new ProfileError(parsed.code, parsed.message);
    }
    throw new Error(
      `profile api failed (${res.status})${body.length > 0 ? `: ${body}` : ''}`
    );
  }
  return (await res.json()) as T;
}

export { isProfileError, ProfileError };
