import { asKeyword } from '@pkgs/keyword/keyword';
import { jsonKvCodec } from '@pkgs/kv/kv-state-codec';
import type { Kv } from '@pkgs/kv/interface';

export type SyncTokenCredentials = {
  readonly token: string;
  readonly expiresAt: number;
};

const SYNC_TOKEN_ROW_KEY = asKeyword('sync.cache/token');
const SYNC_TOKEN_VALUE_ATTR = asKeyword('sync.cache/value');

const TOKEN_REFRESH_BUFFER_SECONDS = 60;

type CachedSyncToken = SyncTokenCredentials & {
  readonly authKey: string;
};

function isCachedSyncToken(v: unknown): v is CachedSyncToken {
  if (typeof v !== 'object' || v === null) return false;
  const row = v as CachedSyncToken;
  return (
    typeof row.token === 'string' &&
    row.token.length > 0 &&
    typeof row.expiresAt === 'number' &&
    Number.isFinite(row.expiresAt) &&
    typeof row.authKey === 'string'
  );
}

const syncTokenCodec = jsonKvCodec<CachedSyncToken>(
  SYNC_TOKEN_VALUE_ATTR,
  isCachedSyncToken
);

export async function readCachedSyncToken(args: {
  readonly kv: Kv;
  readonly authKey: string;
  readonly nowSeconds: number;
}): Promise<SyncTokenCredentials | null> {
  const row = await args.kv.get(SYNC_TOKEN_ROW_KEY);
  if (row === null) return null;
  const cached = syncTokenCodec.decode(row);
  if (cached === undefined) return null;
  if (cached.authKey !== args.authKey) return null;
  if (cached.expiresAt - args.nowSeconds <= TOKEN_REFRESH_BUFFER_SECONDS) {
    return null;
  }
  return { token: cached.token, expiresAt: cached.expiresAt };
}

export async function writeCachedSyncToken(args: {
  readonly kv: Kv;
  readonly authKey: string;
  readonly credentials: SyncTokenCredentials;
}): Promise<void> {
  await args.kv.put(
    SYNC_TOKEN_ROW_KEY,
    syncTokenCodec.encode({
      ...args.credentials,
      authKey: args.authKey,
    })
  );
}

export async function clearSyncTokenCache(kv: Kv): Promise<void> {
  await kv.zap(SYNC_TOKEN_ROW_KEY);
}
