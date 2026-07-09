import { getCachedDeviceId } from '@libs/auth/client/use-device-id';
import { getCachedAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import type { ConfigService } from '@libs/auth/client/config-service-types';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';

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
};

export async function fetchSyncToken(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
}): Promise<string> {
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
  return json.token;
}

export async function uploadSyncBatch(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly batch: UploadBatch;
}): Promise<void> {
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
}
