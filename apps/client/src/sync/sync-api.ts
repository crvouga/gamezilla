import type { ClientRequestAuth } from '@libs/auth/client/client-request-auth';
import type { ConfigService } from '@libs/auth/client/config-service-types';
import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { SPACE_USERS_TABLE, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { tablePolicyFor } from '@libs/db/shared/table-policy';
import { SYNC_TABLE_REGISTRY } from '@libs/db/shared/table-registry';
import type { Kv } from '@pkgs/kv/interface';
import {
  uploadRowNeedsApply,
  type UploadBatch,
  type UploadRow,
} from '@pkgs/sync-engine/shared/upload-batch';

import {
  readCachedSyncToken,
  writeCachedSyncToken,
  type SyncTokenCredentials,
} from './sync-token-cache';

/** Parent tables before children so create-space FK applies in one pass. */
function uploadTablePriority(table: string): number {
  if (table === SPACES_TABLE.tableName) return 0;
  if (table === SPACE_USERS_TABLE.tableName) return 1;
  return 2;
}

/** Parent tables before children so create-space FK applies in one pass. */
function orderUploadRowsForParentsFirst(
  rows: readonly UploadRow[]
): UploadRow[] {
  return [...rows].sort(
    (a, b) => uploadTablePriority(a.table) - uploadTablePriority(b.table)
  );
}

/**
 * Drop legacy / removed tables (e.g. `space_memberships`) and strip dropped
 * columns (e.g. `active_member_count`) so stuck CRUD can complete after schema
 * migrations without permanently stalling the upload queue.
 */
function keepRegisteredSyncTableRow(row: UploadRow): boolean {
  return SYNC_TABLE_REGISTRY.get(row.table) !== undefined;
}

/** Never upload SERVER_ONLY rows (optimistic mutation side effects stay local). */
function keepUploadablePolicyRow(row: UploadRow): boolean {
  return tablePolicyFor(row.table) !== 'SERVER_ONLY';
}

function stripUnknownSyncColumns(row: UploadRow): UploadRow {
  const def = SYNC_TABLE_REGISTRY.get(row.table);
  if (def === undefined || row.values === undefined) return row;
  const allowed = new Set(def.columns.map((col) => col.name));
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row.values)) {
    if (allowed.has(key)) {
      values[key] = value;
    }
  }
  return { ...row, values };
}

export type { SyncTokenCredentials };

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
  // No users.id yet (anon ensure still in flight) — do not mint/upload.
  if (auth.getAccountId() === null) {
    return null;
  }
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

type SyncTokenResponse = {
  readonly token: string;
  readonly expiresAt?: number;
};

/** Identity key only — auth JWT rotation must not bust a valid PowerSync JWT. */
function syncAuthCacheKey(auth: SyncClientAuth): string {
  const accountId = auth.getAccountId() ?? '';
  const anon = auth.getDeviceId() ?? '';
  return `${accountId}\0${anon}`;
}

async function postSyncToken(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly bearer: string | null;
  readonly deviceId: string | null;
}): Promise<Response> {
  return args.fetchFn(`${args.config.getApiUrl()}/api/sync/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeadersFromBearer(args.bearer, args.deviceId),
    },
  });
}

async function mintSyncTokenCredentials(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly kv: Kv;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly nowSeconds: number;
}): Promise<SyncTokenCredentials> {
  const authKey = syncAuthCacheKey(args.auth);
  const cached = await readCachedSyncToken({
    kv: args.kv,
    authKey,
    nowSeconds: args.nowSeconds,
  });
  if (cached !== null) {
    return cached;
  }

  const deviceId = args.auth.getDeviceId();
  let bearer = await resolveBearerToken(args.auth, args.getFreshAuthToken);
  let res = await postSyncToken({
    config: args.config,
    fetchFn: args.fetchFn,
    bearer,
    deviceId,
  });
  // Stale secure-storage / SWR bearer after idle — force-mint and retry once.
  if (res.status === 401 && args.getFreshAuthToken !== undefined) {
    bearer = await resolveBearerToken(args.auth, args.getFreshAuthToken, {
      skipCache: true,
    });
    res = await postSyncToken({
      config: args.config,
      fetchFn: args.fetchFn,
      bearer,
      deviceId,
    });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `sync token failed (${res.status})${body.length > 0 ? `: ${body}` : ''}`
    );
  }
  const json = (await res.json()) as SyncTokenResponse & {
    readonly subject?: string;
  };
  if (typeof json.token !== 'string' || json.token.length === 0) {
    throw new Error('sync token response missing token');
  }
  const credentials: SyncTokenCredentials = {
    token: json.token,
    expiresAt:
      typeof json.expiresAt === 'number' && Number.isFinite(json.expiresAt)
        ? json.expiresAt
        : args.nowSeconds + 300,
  };
  await writeCachedSyncToken({
    kv: args.kv,
    authKey,
    credentials,
  });
  return credentials;
}

export async function fetchSyncToken(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly kv: Kv;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
}): Promise<SyncTokenCredentials> {
  return mintSyncTokenCredentials({
    config: args.config,
    fetchFn: args.fetchFn,
    kv: args.kv,
    auth: args.auth,
    getFreshAuthToken: args.getFreshAuthToken,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
}

/**
 * Synced-down profiles for other users must not re-enter the upload queue.
 * Ownership mismatches permanently reject and used to stall all CRUD.
 */
function keepUploadableProfileRow(
  row: UploadRow,
  accountId: string | null
): boolean {
  if (row.table !== PROFILES_TABLE.tableName) return true;
  if (accountId === null || accountId.length === 0) return true;
  return row.id === accountId;
}

export function prepareSyncUploadBatch(
  batch: UploadBatch,
  auth: Pick<ClientRequestAuth, 'accountId'> | SyncClientAuth
): UploadBatch {
  const accountId =
    'getAccountId' in auth ? auth.getAccountId() : auth.accountId;
  return {
    rows: orderUploadRowsForParentsFirst(
      batch.rows
        .filter(keepRegisteredSyncTableRow)
        .filter(keepUploadablePolicyRow)
        .map(stripUnknownSyncColumns)
        .filter((row) => keepUploadableProfileRow(row, accountId))
        .filter(uploadRowNeedsApply)
    ),
  };
}

async function postSyncUpload(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly bearer: string | null;
  readonly deviceId: string | null;
  readonly body: string;
}): Promise<Response> {
  return args.fetchFn(`${args.config.getApiUrl()}/api/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeadersFromBearer(args.bearer, args.deviceId),
    },
    body: args.body,
  });
}

type UploadDiscardBody = {
  readonly discard?: boolean;
  readonly failures?: readonly unknown[];
};

/**
 * Upload a CRUD batch. Resolves on 200 or permanent 409 discard (so the
 * PowerSync connector can complete the transaction). Throws on 5xx / network
 * so the SDK retries.
 */
export async function uploadSyncBatch(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly batch: UploadBatch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
}): Promise<void> {
  const prepared = prepareSyncUploadBatch(args.batch, args.auth);
  if (prepared.rows.length === 0) {
    return;
  }
  const body = JSON.stringify(prepared);
  const deviceId = args.auth.getDeviceId();
  let bearer = await resolveBearerToken(args.auth, args.getFreshAuthToken);
  let res = await postSyncUpload({
    config: args.config,
    fetchFn: args.fetchFn,
    bearer,
    deviceId,
    body,
  });
  if (res.status === 401 && args.getFreshAuthToken !== undefined) {
    bearer = await resolveBearerToken(args.auth, args.getFreshAuthToken, {
      skipCache: true,
    });
    res = await postSyncUpload({
      config: args.config,
      fetchFn: args.fetchFn,
      bearer,
      deviceId,
      body,
    });
  }
  if (res.status === 409) {
    const discardBody = (await res
      .json()
      .catch(() => ({}))) as UploadDiscardBody;
    if (discardBody.discard === true) {
      return;
    }
    throw new Error('sync upload conflict without discard');
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new Error(
      `sync upload failed (${res.status})${bodyText.length > 0 ? `: ${bodyText}` : ''}`
    );
  }
  await res.json().catch(() => ({}));
}
