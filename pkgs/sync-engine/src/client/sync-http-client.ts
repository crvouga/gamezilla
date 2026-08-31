import { SYNC_PROTOCOL_HEADER, SYNC_PROTOCOL_VERSION } from '../protocol';
import type { QueryResponse } from '../queries/core/types';
import type {
  MutationUploadResult,
  MutationUploadRow,
} from './mutation-upload-queue';
import type { Timers } from './sim-ports';
import type { QueryRequest } from './subscription-runtime';
import { SyncHttpRateLimitError } from './sync-http-rate-limit-error';

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
  readonly reason: 'expired' | 'revoked' | 'upgrade_required';
  constructor(reason: 'expired' | 'revoked' | 'upgrade_required') {
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
  readonly timers: Timers;
  readonly now: () => number;
};

const FRESH_TOKEN_TIMEOUT_MS = 4_000;
/** Refresh a bit before JWT exp to avoid a wasted 401 round-trip. */
const TOKEN_EXPIRY_SKEW_MS = 30_000;
const DEFAULT_PATHS: SyncHttpClientPaths = {
  query: '/api/query',
  mutations: '/api/mutations',
};

/** True when JWT `exp` is missing/unparseable or still valid beyond skew. */
function sessionTokenLikelyValid(token: string, now: () => number): boolean {
  const parts = token.split('.');
  if (parts.length < 2) return false;
  try {
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const json = globalThis.atob(b64);
    const payload = JSON.parse(json) as { readonly exp?: unknown };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 > now() + TOKEN_EXPIRY_SKEW_MS;
  } catch {
    return false;
  }
}
const DEFAULT_ANON_ID_HEADER = 'x-anon-id';

function raceFreshToken(
  getFresh: () => Promise<string | null>,
  timers: Timers
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string | null): void => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = timers.setTimeout(() => done(null), FRESH_TOKEN_TIMEOUT_MS);
    void getFresh()
      .then((t) => {
        timers.clearTimeout(timer);
        done(t);
      })
      .catch(() => {
        timers.clearTimeout(timer);
        done(null);
      });
  });
}

async function resolveBearerToken(
  auth: SyncClientAuth,
  getFreshAuthToken: GetFreshAuthToken | undefined,
  deps: { readonly now: () => number; readonly timers: Timers },
  options?: { readonly skipCache?: boolean }
): Promise<string | null> {
  if (auth.getAccountId() === null) return null;
  const skipCache = options?.skipCache === true;
  // Prefer secure-storage token only while JWT exp is still valid. Expired
  // storage snapshots were causing 401→refresh on nearly every sync HTTP call
  if (!skipCache) {
    const cached = auth.getSessionToken();
    if (
      cached !== null &&
      cached.length > 0 &&
      sessionTokenLikelyValid(cached, deps.now)
    ) {
      return cached;
    }
  }
  if (getFreshAuthToken !== undefined) {
    const fresh = await raceFreshToken(
      () => getFreshAuthToken(options),
      deps.timers
    );
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
  readonly postQueries: (
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
      [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
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
  const deps = {
    now: options.now,
    timers: options.timers,
  };
  const deviceId = options.auth.getDeviceId();
  let bearer = await resolveBearerToken(
    options.auth,
    options.getFreshAuthToken,
    deps
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
    bearer = await resolveBearerToken(
      options.auth,
      options.getFreshAuthToken,
      deps,
      { skipCache: true }
    );
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
    if (json.reason === 'upgrade_required') {
      throw new SyncApiAuthError('upgrade_required');
    }
    throw new SyncApiAuthError(
      json.reason === 'revoked' ? 'revoked' : 'expired'
    );
  }
  if (response.status === 429) {
    const retryHeader = response.headers.get('Retry-After');
    const retryAfterMs =
      retryHeader !== null && /^\d+$/.test(retryHeader)
        ? Number(retryHeader) * 1_000
        : 2_000;
    throw new SyncHttpRateLimitError(retryAfterMs);
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
    postQueries: (requests) => postQueriesVia(authed, paths.query, requests),
    postMutations: async (mutations) =>
      (await authed(
        paths.mutations,
        JSON.stringify({ mutations })
      )) as MutationUploadResult,
  };
}

async function postQueriesVia(
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
