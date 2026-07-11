import { asKeyword } from '@pkgs/keyword/keyword';
import { jsonKvCodec } from '@pkgs/kv/kv-state-codec';
import type { Kv } from '@pkgs/kv/interface';

const EVER_SYNCED_ROW_KEY = asKeyword('sync.cache/ever-synced');
const EVER_SYNCED_VALUE_ATTR = asKeyword('sync.cache/value');

type CachedEverSynced = {
  readonly sessionKey: string;
  readonly value: true;
};

function isCachedEverSynced(v: unknown): v is CachedEverSynced {
  if (typeof v !== 'object' || v === null) return false;
  const row = v as CachedEverSynced;
  return row.value === true && typeof row.sessionKey === 'string';
}

const everSyncedCodec = jsonKvCodec<CachedEverSynced>(
  EVER_SYNCED_VALUE_ATTR,
  isCachedEverSynced
);

export async function readEverSyncedFromKv(args: {
  readonly kv: Kv;
  readonly sessionKey: string;
}): Promise<boolean> {
  const row = await args.kv.get(EVER_SYNCED_ROW_KEY);
  if (row === null) return false;
  const cached = everSyncedCodec.decode(row);
  if (cached === undefined) return false;
  return cached.sessionKey === args.sessionKey && cached.value === true;
}

export async function writeEverSyncedToKv(args: {
  readonly kv: Kv;
  readonly sessionKey: string;
}): Promise<void> {
  await args.kv.put(
    EVER_SYNCED_ROW_KEY,
    everSyncedCodec.encode({
      sessionKey: args.sessionKey,
      value: true,
    })
  );
}

export async function clearEverSyncedFromKv(kv: Kv): Promise<void> {
  await kv.zap(EVER_SYNCED_ROW_KEY);
}

/** Tab-lifetime memory latch — survives sync-engine wrapper recreation (e.g. dev HMR). */
const memoryEverSyncedBySession = new Map<string, boolean>();

export function readMemoryEverSynced(sessionKey: string): boolean {
  return memoryEverSyncedBySession.get(sessionKey) ?? false;
}

export type EverSyncedLatch = {
  readonly read: () => boolean;
  readonly latch: () => void;
  readonly reset: () => void;
};

/** In-process latch backed by Kv so hasEverSynced survives wrapper recreation. */
export function createKvEverSyncedLatch(args: {
  readonly kv: Kv;
  readonly sessionKey: string;
  readonly initial: boolean;
}): EverSyncedLatch {
  let value = args.initial || readMemoryEverSynced(args.sessionKey);
  memoryEverSyncedBySession.set(args.sessionKey, value);
  return {
    read: () => value || readMemoryEverSynced(args.sessionKey),
    latch: () => {
      if (value) return;
      value = true;
      memoryEverSyncedBySession.set(args.sessionKey, true);
      void writeEverSyncedToKv({
        kv: args.kv,
        sessionKey: args.sessionKey,
      });
    },
    reset: () => {
      value = false;
      memoryEverSyncedBySession.delete(args.sessionKey);
      void clearEverSyncedFromKv(args.kv);
    },
  };
}
