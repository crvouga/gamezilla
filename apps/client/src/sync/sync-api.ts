import { getCachedCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { getCachedDeviceId } from '@libs/auth/client/use-device-id';
import { getCachedAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import type { ConfigService } from '@libs/auth/client/config-service-types';
import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { SPACE_USERS_TABLE, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { SYNC_TABLE_REGISTRY } from '@libs/db/shared/table-registry';
import { stripServerOwnedProfileUploadColumns } from '@libs/profile/shared/strip-server-owned-profile-upload-columns';
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
  getFreshAuthToken: GetFreshAuthToken | undefined,
  options?: { readonly skipCache?: boolean }
): Promise<string | null> {
  if (getFreshAuthToken !== undefined) {
    const fresh = await raceFreshToken(() => getFreshAuthToken(options));
    if (fresh !== null && fresh.length > 0) return fresh;
  }
  return getCachedAuthToken();
}

function authHeadersFromBearer(token: string | null): Record<string, string> {
  const anon = getCachedDeviceId();
  if (token !== null && token.length > 0) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (anon !== null && anon.length > 0) {
      headers[X_ANON_ID] = anon;
    }
    return headers;
  }
  if (anon !== null && anon.length > 0) {
    return { [X_ANON_ID]: anon };
  }
  return {};
}

type SyncTokenResponse = {
  readonly token: string;
  readonly expiresAt?: number;
};

/** Identity key only — auth JWT rotation must not bust a valid PowerSync JWT. */
function syncAuthCacheKey(): string {
  const accountId = getCachedCurrentAccountId() ?? '';
  const anon = getCachedDeviceId() ?? '';
  return `${accountId}\0${anon}`;
}

async function postSyncToken(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly bearer: string | null;
}): Promise<Response> {
  return args.fetchFn(`${args.config.getApiUrl()}/api/sync/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeadersFromBearer(args.bearer),
    },
  });
}

async function mintSyncTokenCredentials(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly kv: Kv;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly nowSeconds: number;
}): Promise<SyncTokenCredentials> {
  const authKey = syncAuthCacheKey();
  const cached = await readCachedSyncToken({
    kv: args.kv,
    authKey,
    nowSeconds: args.nowSeconds,
  });
  if (cached !== null) {
    return cached;
  }

  let bearer = await resolveBearerToken(args.getFreshAuthToken);
  let res = await postSyncToken({
    config: args.config,
    fetchFn: args.fetchFn,
    bearer,
  });
  // Stale secure-storage / SWR bearer after idle — force-mint and retry once.
  if (res.status === 401 && args.getFreshAuthToken !== undefined) {
    bearer = await resolveBearerToken(args.getFreshAuthToken, {
      skipCache: true,
    });
    res = await postSyncToken({
      config: args.config,
      fetchFn: args.fetchFn,
      bearer,
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
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
}): Promise<SyncTokenCredentials> {
  return mintSyncTokenCredentials({
    config: args.config,
    fetchFn: args.fetchFn,
    kv: args.kv,
    getFreshAuthToken: args.getFreshAuthToken,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
}

/** Account id when signed in, else install device id (matches server `myId`). */
function resolveClientMyId(): string | null {
  const accountId = getCachedCurrentAccountId();
  if (accountId !== null && accountId.length > 0) return accountId;
  const deviceId = getCachedDeviceId();
  if (deviceId !== null && deviceId.length > 0) return deviceId;
  return null;
}

/**
 * Synced-down profiles for other users must not re-enter the upload queue.
 * Ownership mismatches permanently reject and used to stall all CRUD.
 */
function keepUploadableProfileRow(row: UploadRow): boolean {
  if (row.table !== PROFILES_TABLE.tableName) return true;
  const myId = resolveClientMyId();
  if (myId === null) return true;
  return row.id === myId;
}

/**
 * Drop server-owned profile columns and skip put/patch rows that become
 * empty (e.g. local `applyEnsuredUsername` → username-only PATCH). Completing
 * those as accepted no-ops clears the PowerSync CRUD queue without a round
 * trip that would otherwise assert on the API.
 */
export function prepareSyncUploadBatch(batch: UploadBatch): UploadBatch {
  return {
    rows: orderUploadRowsForParentsFirst(
      batch.rows
        .filter(keepRegisteredSyncTableRow)
        .map(stripUnknownSyncColumns)
        .map(stripServerOwnedProfileUploadColumns)
        .filter(keepUploadableProfileRow)
        .filter(uploadRowNeedsApply)
    ),
  };
}

async function postSyncUpload(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly bearer: string | null;
  readonly body: string;
}): Promise<Response> {
  return args.fetchFn(`${args.config.getApiUrl()}/api/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeadersFromBearer(args.bearer),
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
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
}): Promise<void> {
  const prepared = prepareSyncUploadBatch(args.batch);
  if (prepared.rows.length === 0) {
    return;
  }
  const body = JSON.stringify(prepared);
  let bearer = await resolveBearerToken(args.getFreshAuthToken);
  let res = await postSyncUpload({
    config: args.config,
    fetchFn: args.fetchFn,
    bearer,
    body,
  });
  if (res.status === 401 && args.getFreshAuthToken !== undefined) {
    bearer = await resolveBearerToken(args.getFreshAuthToken, {
      skipCache: true,
    });
    res = await postSyncUpload({
      config: args.config,
      fetchFn: args.fetchFn,
      bearer,
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
