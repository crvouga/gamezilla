import { getCachedDeviceId } from '@libs/auth/client/use-device-id';
import { getCachedAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import type { ConfigService } from '@libs/auth/client/config-service-types';
import { stripServerOwnedProfileUploadColumns } from '@libs/profile/shared/strip-server-owned-profile-upload-columns';
import type { Kv } from '@pkgs/kv/interface';
import {
  uploadRowNeedsApply,
  type UploadBatch,
  type UploadBatchResult,
} from '@pkgs/sync-engine/shared/upload-batch';
import { fail, WriteError } from '@pkgs/write/shared/write-result';

import {
  readCachedSyncToken,
  writeCachedSyncToken,
  type SyncTokenCredentials,
} from './sync-token-cache';

export type { SyncTokenCredentials };

/** Must match {@link ANON_ID_HEADER} in apps/api session-middleware. */
const X_ANON_ID = 'x-anon-id';

export type SyncApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function authHeaders(): Record<string, string> {
  const token = getCachedAuthToken();
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

function authHeadersKey(): string {
  const token = getCachedAuthToken() ?? '';
  const anon = getCachedDeviceId() ?? '';
  return `${token}\0${anon}`;
}

export async function fetchSyncToken(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly kv: Kv;
}): Promise<SyncTokenCredentials> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const authKey = authHeadersKey();
  const cached = await readCachedSyncToken({
    kv: args.kv,
    authKey,
    nowSeconds,
  });
  if (cached !== null) {
    return cached;
  }

  const res = await args.fetchFn(`${args.config.getApiUrl()}/api/sync/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `sync token failed (${res.status})${body.length > 0 ? `: ${body}` : ''}`
    );
  }
  const json = (await res.json()) as SyncTokenResponse;
  if (typeof json.token !== 'string' || json.token.length === 0) {
    throw new Error('sync token response missing token');
  }
  const credentials: SyncTokenCredentials = {
    token: json.token,
    expiresAt:
      typeof json.expiresAt === 'number' && Number.isFinite(json.expiresAt)
        ? json.expiresAt
        : nowSeconds + 300,
  };
  await writeCachedSyncToken({
    kv: args.kv,
    authKey,
    credentials,
  });
  return credentials;
}

function assertUploadBatchAccepted(result: UploadBatchResult): void {
  const rejected = result.results.find((row) => row.status === 'rejected');
  if (rejected === undefined) {
    return;
  }
  const code =
    rejected.status === 'rejected' ? rejected.reason : 'UPLOAD_REJECTED';
  throw new WriteError(fail(code, code));
}

/**
 * Drop server-owned profile columns and skip put/patch rows that become
 * empty (e.g. local `applyEnsuredUsername` → username-only PATCH). Completing
 * those as accepted no-ops clears the PowerSync CRUD queue without a round
 * trip that would otherwise assert on the API.
 */
export function prepareSyncUploadBatch(batch: UploadBatch): UploadBatch {
  return {
    rows: batch.rows
      .map(stripServerOwnedProfileUploadColumns)
      .filter(uploadRowNeedsApply),
  };
}

export async function uploadSyncBatch(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly batch: UploadBatch;
}): Promise<UploadBatchResult> {
  const prepared = prepareSyncUploadBatch(args.batch);
  if (prepared.rows.length === 0) {
    return {
      results: args.batch.rows.map(() => ({ status: 'accepted' as const })),
    };
  }
  const res = await args.fetchFn(`${args.config.getApiUrl()}/api/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(prepared),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `sync upload failed (${res.status})${body.length > 0 ? `: ${body}` : ''}`
    );
  }
  const result = (await res.json()) as UploadBatchResult;
  assertUploadBatchAccepted(result);
  return result;
}
