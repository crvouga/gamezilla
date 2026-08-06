import type { QueryResponse } from '../queries/core/types';
import type {
  MutationUploadResult,
  MutationUploadRow,
} from './mutation-upload-queue';
import type { QueryRequest } from './subscription-fetch';

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
  readonly queryBatch: string;
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
/** Refresh a bit before JWT exp to avoid a wasted 401 round-trip. */
const TOKEN_EXPIRY_SKEW_MS = 30_000;
const DEFAULT_PATHS: SyncHttpClientPaths = {
  query: '/api/query',
  queryBatch: '/api/query/batch',
  mutations: '/api/mutations',
};

/** True when JWT `exp` is missing/unparseable or still valid beyond skew. */
function sessionTokenLikelyValid(token: string): boolean {
  const parts = token.split('.');
  if (parts.length < 2) return false;
  try {
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const json = globalThis.atob(b64);
    const payload = JSON.parse(json) as { readonly exp?: unknown };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 > Date.now() + TOKEN_EXPIRY_SKEW_MS;
  } catch {
    return false;
  }
}
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
  const skipCache = options?.skipCache === true;
  // Prefer secure-storage token only while JWT exp is still valid. Expired
  // storage snapshots were causing 401→refresh on nearly every sync HTTP call
  // (~3–4s) even though Clerk already had a newer in-memory token.
  if (!skipCache) {
    const cached = auth.getSessionToken();
    if (
      cached !== null &&
      cached.length > 0 &&
      sessionTokenLikelyValid(cached)
    ) {
      return cached;
    }
  }
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
  readonly postQueryBatch: (
    requests: readonly QueryRequest[]
  ) => Promise<readonly QueryResponse[]>;
  readonly postMutations: (
    mutations: readonly MutationUploadRow[]
  ) => Promise<MutationUploadResult>;
};

type PostJsonArgs = {
  readonly options: CreateSyncHttpClientOptions;
  readonly anonIdHeader: string;
  readonly path: string;
  readonly body: string;
  readonly bearer: string | null;
  readonly deviceId: string | null;
};

function postJson(args: PostJsonArgs): Promise<Response> {
  return args.options.fetchFn(`${args.options.getBaseUrl()}${args.path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeadersFromBearer(args.bearer, args.deviceId, args.anonIdHeader),
    },
    body: args.body,
  });
}

async function postAuthedJson(
  options: CreateSyncHttpClientOptions,
  anonIdHeader: string,
  path: string,
  body: string
): Promise<unknown> {
  const deviceId = options.auth.getDeviceId();
  let bearer = await resolveBearerToken(
    options.auth,
    options.getFreshAuthToken
  );
  let response = await postJson({
    options,
    anonIdHeader,
    path,
    body,
    bearer,
    deviceId,
  });
  if (response.status === 401 && options.getFreshAuthToken !== undefined) {
    bearer = await resolveBearerToken(options.auth, options.getFreshAuthToken, {
      skipCache: true,
    });
    response = await postJson({
      options,
      anonIdHeader,
      path,
      body,
      bearer,
      deviceId,
    });
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

/** Authed POST helpers for `/api/query` and `/api/mutations`. */
export function createSyncHttpClient(
  options: CreateSyncHttpClientOptions
): SyncHttpClient {
  const paths = options.paths ?? DEFAULT_PATHS;
  const anonIdHeader = options.anonIdHeader ?? DEFAULT_ANON_ID_HEADER;
  const authed = (path: string, body: string) =>
    postAuthedJson(options, anonIdHeader, path, body);

  return {
    postQuery: async (request) =>
      (await authed(paths.query, JSON.stringify(request))) as QueryResponse,
    postQueryBatch: (requests) =>
      postQueryBatchVia(authed, paths.queryBatch, requests),
    postMutations: async (mutations) =>
      (await authed(
        paths.mutations,
        JSON.stringify({ mutations })
      )) as MutationUploadResult,
  };
}

async function postQueryBatchVia(
  postAuthedJson: (path: string, body: string) => Promise<unknown>,
  path: string,
  requests: readonly QueryRequest[]
): Promise<readonly QueryResponse[]> {
  const body = (await postAuthedJson(
    path,
    JSON.stringify({ queries: requests })
  )) as { readonly responses?: unknown };
  if (!Array.isArray(body.responses)) {
    throw new Error(`${path} missing responses array`);
  }
  return body.responses as QueryResponse[];
}
