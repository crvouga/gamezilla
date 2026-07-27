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

function debugJwtSubject(token: string): {
  readonly subPrefix: string;
  readonly subLen: number;
  readonly hasDeviceClaim: boolean;
} {
  try {
    const payload = token.split('.')[1];
    if (payload === undefined) {
      return { subPrefix: '', subLen: 0, hasDeviceClaim: false };
    }
    const json = JSON.parse(
      globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    ) as Record<string, unknown>;
    const sub = typeof json['sub'] === 'string' ? json['sub'] : '';
    return {
      subPrefix: sub.slice(0, 8),
      subLen: sub.length,
      hasDeviceClaim: typeof json['device_id'] === 'string',
    };
  } catch {
    return { subPrefix: '', subLen: 0, hasDeviceClaim: false };
  }
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
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'115aa4'},body:JSON.stringify({sessionId:'115aa4',runId:'pre-fix',hypothesisId:'B',location:'sync-api.ts:fetchSyncToken',message:'sync token cache hit',data:{...debugJwtSubject(cached.token),apiHost:(()=>{try{return new URL(args.config.getApiUrl()).host}catch{return 'bad'}})()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'115aa4'},body:JSON.stringify({sessionId:'115aa4',runId:'pre-fix',hypothesisId:'B',location:'sync-api.ts:fetchSyncToken',message:'sync token failed',data:{status:res.status,bodyLen:body.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'115aa4'},body:JSON.stringify({sessionId:'115aa4',runId:'pre-fix',hypothesisId:'B',location:'sync-api.ts:fetchSyncToken',message:'sync token minted',data:{...debugJwtSubject(credentials.token),responseSubject:typeof (json as {subject?:unknown}).subject==='string'?(json as {subject:string}).subject.slice(0,8):null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'115aa4'},body:JSON.stringify({sessionId:'115aa4',runId:'pre-fix',hypothesisId:'A',location:'sync-api.ts:uploadSyncBatch',message:'sync upload http failed',data:{status:res.status,tables:prepared.rows.map((r)=>r.table),ops:prepared.rows.map((r)=>r.op)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new Error(
      `sync upload failed (${res.status})${body.length > 0 ? `: ${body}` : ''}`
    );
  }
  const result = (await res.json()) as UploadBatchResult;
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'115aa4'},body:JSON.stringify({sessionId:'115aa4',runId:'pre-fix',hypothesisId:'A',location:'sync-api.ts:uploadSyncBatch',message:'sync upload response',data:{tables:prepared.rows.map((r)=>r.table),statuses:result.results.map((r)=>r.status),reasons:result.results.map((r)=>r.status==='rejected'?r.reason:null)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  assertUploadBatchAccepted(result);
  return result;
}
