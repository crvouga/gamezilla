import type { Timers } from '@pkgs/clock-shared-ts/types';
import { observeSync } from '@pkgs/observability-root-shared-ts/span';
import type { QueryResponse } from '@pkgs/sync-engine-shared-ts/v2';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';
import type {
  MutationUploadResult,
  MutationUploadRow,
} from './mutation-upload-queue';
import { postQueryBatch } from './post-query-batch';
import { validateWireQueryBatch } from './query-wire-validation';
import type { QueryRequest } from './subscription-runtime';
import { SyncHttpPayloadTooLargeError } from './sync-http-payload-too-large-error';
import { SyncHttpRateLimitError } from './sync-http-rate-limit-error';

export type SyncHttpFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Async session refresh — same role as reconnect `getFreshToken`. */
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
  constructor(
    reason: 'expired' | 'revoked' | 'upgrade_required',
    message?: string
  ) {
    super(message ?? `auth:${reason}`);
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

/**
 * True when the bearer can be sent without a proactive refresh race.
 * Opaque IdP tokens (`createId()` strings, not JWTs) are always valid here —
 * only JWT `exp` past skew forces a fresh-token race before the POST.
 */
function sessionTokenLikelyValid(token: string, now: () => number): boolean {
  const parts = token.split('.');
  if (parts.length < 2) return true;
  try {
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const json = globalThis.atob(b64);
    const payload = JSON.parse(json) as { readonly exp?: unknown };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 > now() + TOKEN_EXPIRY_SKEW_MS;
  } catch {
    return true;
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

/** Maps a refused sync response to the error its caller acts on. */
async function throwForFailure(response: Response, path: string) {
  if (response.status === 401) {
    // Malformed 401 bodies still map to auth errors (operating, not programmer).
    const json = (await response.json().catch(() => ({}))) as {
      readonly reason?: unknown;
      readonly message?: unknown;
    };
    if (json.reason === 'upgrade_required') {
      throw new SyncApiAuthError('upgrade_required');
    }
    throw new SyncApiAuthError(
      json.reason === 'revoked' ? 'revoked' : 'expired',
      typeof json.message === 'string' ? json.message : undefined
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
  if (response.status === 413) {
    const json = (await response.json().catch(() => ({}))) as {
      readonly maxBytes?: unknown;
    };
    throw new SyncHttpPayloadTooLargeError(
      typeof json.maxBytes === 'number' ? json.maxBytes : null
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `${path} failed (${response.status})${text.length > 0 ? `: ${text}` : ''}`
    );
  }
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
    // regression: sync-upgrade-required-refreshes-session
    // A protocol refusal cannot be repaired by changing the person's session.
    const refusal: unknown = await response.json().catch(() => null);
    if (
      typeof refusal === 'object' &&
      refusal !== null &&
      'reason' in refusal &&
      refusal.reason === 'upgrade_required'
    )
      throw new SyncApiAuthError('upgrade_required');
    const previous = bearer;
    bearer = await resolveBearerToken(
      options.auth,
      options.getFreshAuthToken,
      deps,
      { skipCache: true }
    );
    // Same dead IdP bearer after "refresh" — retry with anon headers only so
    // public system topics (client_config) can hydrate and unblock sign-in.
    if (
      previous !== null &&
      bearer !== null &&
      previous === bearer &&
      deviceId !== null &&
      deviceId.length > 0
    ) {
      bearer = null;
    }
    response = await postJson({
      options,
      anonIdHeader,
      path,
      body,
      bearer,
      deviceId,
    });
  }
  await throwForFailure(response, path);
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
    postQueries: (requests) =>
      observeSync('read', () => postQueriesVia(authed, paths.query, requests)),
    postMutations: (mutations) =>
      observeSync(
        'write',
        async () =>
          (await authed(
            paths.mutations,
            JSON.stringify({ mutations })
          )) as MutationUploadResult,
        undefined,
        (result) => validMutationResponse(result, mutations)
      ),
  };
}

async function postQueriesVia(
  postAuthedJson: (path: string, body: string) => Promise<unknown>,
  path: string,
  requests: readonly QueryRequest[]
): Promise<readonly QueryResponse[]> {
  return postQueryBatch(async (chunk) => {
    const body = (await postAuthedJson(
      path,
      JSON.stringify({ queries: chunk })
    )) as { readonly responses?: unknown };
    return validateWireQueryBatch(body.responses, chunk.length);
  }, requests);
}

/** Telemetry validation only: the caller still receives the original wire result. */
function validMutationResponse(
  value: unknown,
  mutations: readonly MutationUploadRow[]
): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<MutationUploadResult>;
  if (
    result.ok !== true ||
    !Number.isFinite(result.serverTimeMs) ||
    !Number.isSafeInteger(result.ackSeq) ||
    (result.ackSeq ?? -1) < 0 ||
    !Array.isArray(result.verdicts) ||
    result.verdicts.length !== mutations.length
  )
    return false;
  const pending = new Set(mutations.map((row) => row.id));
  return result.verdicts.every((verdict) => {
    if (
      typeof verdict !== 'object' ||
      verdict === null ||
      !pending.delete(verdict.mutationId)
    )
      return false;
    return (
      verdict.status === 'applied' ||
      (verdict.status === 'rejected' &&
        typeof verdict.code === 'string' &&
        typeof verdict.message === 'string')
    );
  });
}
