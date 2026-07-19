import { getCachedDeviceId } from '@libs/auth/client/use-device-id';
import { getCachedAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import type { ConfigService } from '@libs/auth/client/config-service-types';
import type { Kv } from '@pkgs/kv/interface';
import type {
  UploadBatch,
  UploadBatchResult,
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

  // #region agent log
  const debugToken = getCachedAuthToken();
  const debugAnon = getCachedDeviceId();
  // #endregion
  const res = await args.fetchFn(`${args.config.getApiUrl()}/api/sync/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
  });
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '11af44',
    },
    body: JSON.stringify({
      sessionId: '11af44',
      hypothesisId: 'F',
      location: 'sync-api.ts:fetchSyncToken',
      message: 'sync token request completed',
      data: {
        status: res.status,
        hadBearer: debugToken !== null && debugToken.length > 0,
        bearerLen: debugToken?.length ?? 0,
        hadAnonId: debugAnon !== null && debugAnon.length > 0,
        anonId: debugAnon,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
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

export async function uploadSyncBatch(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly batch: UploadBatch;
}): Promise<UploadBatchResult> {
  const res = await args.fetchFn(`${args.config.getApiUrl()}/api/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(args.batch),
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
