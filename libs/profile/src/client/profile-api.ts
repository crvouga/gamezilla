import {
  clientAuthHeaders,
  type ClientRequestAuth,
} from '@libs/auth/client/client-request-auth';
import type { ConfigService } from '@libs/auth/client/config-service-types';

import {
  isProfileError,
  ProfileError,
  type ProfileErrorCode,
} from '../shared/profile-errors';

export type ProfileApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type ProfileClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: ProfileApiFetch;
  readonly auth: ClientRequestAuth;
};

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
  readonly auth: ClientRequestAuth;
  readonly path: string;
  readonly init?: RequestInit;
}): Promise<Response> {
  const url = `${args.config.getApiUrl()}/api${args.path}`;
  return args.fetchFn(url, {
    ...args.init,
    headers: {
      ...clientAuthHeaders(args.auth, { requireAccountIdForBearer: true }),
      ...args.init?.headers,
    },
  });
}

export async function profileApiJson<T>(args: {
  readonly config: ConfigService;
  readonly fetchFn: ProfileApiFetch;
  readonly auth: ClientRequestAuth;
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
