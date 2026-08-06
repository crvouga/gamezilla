import type { ConfigService } from '@libs/auth/client/config-service-types';
import type {
  MutationUploadResult,
  MutationUploadRow,
} from '@pkgs/sync-engine/client/mutation-upload-queue';
import type { QueryRequest } from '@pkgs/sync-engine/client/subscription-runtime';
import type { QueryResponse } from '@pkgs/queries/core/types';

/** Must match {@link ANON_ID_HEADER} in apps/api session-middleware. */
const X_ANON_ID = 'x-anon-id';

export type SyncApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Async session refresh — same role as room reconnect `getFreshToken`. */
export type GetFreshAuthToken = (options?: {
  readonly skipCache?: boolean;
}) => Promise<string | null>;

/**
 * Live identity/token getters injected from React. Must not close over stale
 * render values — pass refs that track the latest hooks.
 */
export type SyncClientAuth = {
  readonly getAccountId: () => string | null;
  readonly getDeviceId: () => string | null;
  readonly getSessionToken: () => string | null;
};

export class SyncApiAuthError extends Error {
  readonly reason: 'expired' | 'revoked';
  constructor(reason: 'expired' | 'revoked') {
    super(`auth:${reason}`);
    this.reason = reason;
  }
}

const FRESH_TOKEN_TIMEOUT_MS = 4_000;

function raceFreshToken(
  getFresh: () => Promise<string | null>
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string | null): void => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = setTimeout(() => done(null), FRESH_TOKEN_TIMEOUT_MS);
    void getFresh()
      .then((t) => {
        clearTimeout(timer);
        done(t);
      })
      .catch(() => {
        clearTimeout(timer);
        done(null);
      });
  });
}

async function resolveBearerToken(
  auth: SyncClientAuth,
  getFreshAuthToken: GetFreshAuthToken | undefined,
  options?: { readonly skipCache?: boolean }
): Promise<string | null> {
  if (auth.getAccountId() === null) return null;
  if (getFreshAuthToken !== undefined) {
    const fresh = await raceFreshToken(() => getFreshAuthToken(options));
    if (fresh !== null && fresh.length > 0) return fresh;
  }
  return auth.getSessionToken();
}

function authHeadersFromBearer(
  token: string | null,
  deviceId: string | null
): Record<string, string> {
  if (token !== null && token.length > 0) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (deviceId !== null && deviceId.length > 0) {
      headers[X_ANON_ID] = deviceId;
    }
    return headers;
  }
  if (deviceId !== null && deviceId.length > 0) {
    return { [X_ANON_ID]: deviceId };
  }
  return {};
}

function postJson(
  args: {
    readonly config: ConfigService;
    readonly fetchFn: SyncApiFetch;
    readonly path: '/api/query' | '/api/mutations';
    readonly body: string;
  },
  bearer: string | null,
  deviceId: string | null
): Promise<Response> {
  return args.fetchFn(`${args.config.getApiUrl()}${args.path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeadersFromBearer(bearer, deviceId),
    },
    body: args.body,
  });
}

async function postAuthedJson(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly path: '/api/query' | '/api/mutations';
  readonly body: string;
}): Promise<unknown> {
  const deviceId = args.auth.getDeviceId();
  let bearer = await resolveBearerToken(args.auth, args.getFreshAuthToken);
  let response = await postJson(args, bearer, deviceId);
  if (response.status === 401 && args.getFreshAuthToken !== undefined) {
    bearer = await resolveBearerToken(args.auth, args.getFreshAuthToken, {
      skipCache: true,
    });
    response = await postJson(args, bearer, deviceId);
  }
  if (response.status === 401) {
    const json = (await response.json().catch(() => ({}))) as {
      readonly reason?: unknown;
    };
    throw new SyncApiAuthError(
      json.reason === 'revoked' ? 'revoked' : 'expired'
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `${args.path} failed (${response.status})${text.length > 0 ? `: ${text}` : ''}`
    );
  }
  return response.json();
}

export async function postAppQuery(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly request: QueryRequest;
}): Promise<QueryResponse> {
  return (await postAuthedJson({
    ...args,
    path: '/api/query',
    body: JSON.stringify(args.request),
  })) as QueryResponse;
}

export async function postMutationBatch(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly mutations: readonly MutationUploadRow[];
}): Promise<MutationUploadResult> {
  return (await postAuthedJson({
    ...args,
    path: '/api/mutations',
    body: JSON.stringify({ mutations: args.mutations }),
  })) as MutationUploadResult;
}
