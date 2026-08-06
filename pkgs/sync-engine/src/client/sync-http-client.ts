import type { QueryResponse } from '../queries/core/types';
import type {
  MutationUploadResult,
  MutationUploadRow,
} from './mutation-upload-queue';
import type { QueryRequest } from './subscription-runtime';

export type SyncHttpFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Async session refresh — same role as room reconnect `getFreshToken`. */
export type GetFreshAuthToken = (options?: {
  readonly skipCache?: boolean;
}) => Promise<string | null>;

/**
 * Live identity/token getters injected from the host. Must not close over stale
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

export type SyncHttpClientPaths = {
  readonly query: string;
  readonly mutations: string;
};

export type CreateSyncHttpClientOptions = {
  readonly getBaseUrl: () => string;
  readonly fetchFn: SyncHttpFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  /** Defaults: `/api/query`, `/api/mutations`. */
  readonly paths?: SyncHttpClientPaths | undefined;
  /** Extra header name for device/anon id. Default `x-anon-id`. */
  readonly anonIdHeader?: string | undefined;
};

const FRESH_TOKEN_TIMEOUT_MS = 4_000;
const DEFAULT_PATHS: SyncHttpClientPaths = {
  query: '/api/query',
  mutations: '/api/mutations',
};
const DEFAULT_ANON_ID_HEADER = 'x-anon-id';

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
  deviceId: string | null,
  anonIdHeader: string
): Record<string, string> {
  if (token !== null && token.length > 0) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (deviceId !== null && deviceId.length > 0) {
      headers[anonIdHeader] = deviceId;
    }
    return headers;
  }
  if (deviceId !== null && deviceId.length > 0) {
    return { [anonIdHeader]: deviceId };
  }
  return {};
}

export type SyncHttpClient = {
  readonly postQuery: (request: QueryRequest) => Promise<QueryResponse>;
  readonly postMutations: (
    mutations: readonly MutationUploadRow[]
  ) => Promise<MutationUploadResult>;
};

/** Authed POST helpers for `/api/query` and `/api/mutations`. */
export function createSyncHttpClient(
  options: CreateSyncHttpClientOptions
): SyncHttpClient {
  const paths = options.paths ?? DEFAULT_PATHS;
  const anonIdHeader = options.anonIdHeader ?? DEFAULT_ANON_ID_HEADER;

  function postJson(
    path: string,
    body: string,
    bearer: string | null,
    deviceId: string | null
  ): Promise<Response> {
    return options.fetchFn(`${options.getBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeadersFromBearer(bearer, deviceId, anonIdHeader),
      },
      body,
    });
  }

  async function postAuthedJson(path: string, body: string): Promise<unknown> {
    const deviceId = options.auth.getDeviceId();
    let bearer = await resolveBearerToken(
      options.auth,
      options.getFreshAuthToken
    );
    let response = await postJson(path, body, bearer, deviceId);
    if (response.status === 401 && options.getFreshAuthToken !== undefined) {
      bearer = await resolveBearerToken(
        options.auth,
        options.getFreshAuthToken,
        { skipCache: true }
      );
      response = await postJson(path, body, bearer, deviceId);
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
        `${path} failed (${response.status})${text.length > 0 ? `: ${text}` : ''}`
      );
    }
    return response.json();
  }

  return {
    postQuery: async (request) =>
      (await postAuthedJson(
        paths.query,
        JSON.stringify(request)
      )) as QueryResponse,
    postMutations: async (mutations) =>
      (await postAuthedJson(
        paths.mutations,
        JSON.stringify({ mutations })
      )) as MutationUploadResult,
  };
}
