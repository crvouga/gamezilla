import { asKeyword } from '@pkgs/keyword/keyword';
import { jsonKvCodec } from '@pkgs/kv/kv-state-codec';
import type { Kv } from '@pkgs/kv/interface';

const EVER_SYNCED_ROW_KEY = asKeyword('sync.cache/ever-synced');
const EVER_SYNCED_VALUE_ATTR = asKeyword('sync.cache/value');

type EverSyncedMap = Readonly<Record<string, true>>;

function isEverSyncedMap(v: unknown): v is EverSyncedMap {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  for (const [key, value] of Object.entries(v)) {
    if (typeof key !== 'string' || key.length === 0) return false;
    if (value !== true) return false;
  }
  return true;
}

const everSyncedCodec = jsonKvCodec<EverSyncedMap>(
  EVER_SYNCED_VALUE_ATTR,
  isEverSyncedMap
);

export async function readEverSyncedFromKv(args: {
  readonly kv: Kv;
  readonly sessionKey: string;
}): Promise<boolean> {
  const row = await args.kv.get(EVER_SYNCED_ROW_KEY);
  if (row === null) return false;
  const cached = everSyncedCodec.decode(row);
  if (cached === undefined) return false;
  return cached[args.sessionKey] === true;
}

export async function writeEverSyncedToKv(args: {
  readonly kv: Kv;
  readonly sessionKey: string;
}): Promise<void> {
  const row = await args.kv.get(EVER_SYNCED_ROW_KEY);
  const prev = row !== null ? (everSyncedCodec.decode(row) ?? {}) : {};
  await args.kv.put(
    EVER_SYNCED_ROW_KEY,
    everSyncedCodec.encode({
      ...prev,
      [args.sessionKey]: true,
    })
  );
}

export async function clearEverSyncedFromKv(
  kv: Kv,
  sessionKey?: string
): Promise<void> {
  if (sessionKey === undefined) {
    await kv.zap(EVER_SYNCED_ROW_KEY);
    return;
  }
  const row = await kv.get(EVER_SYNCED_ROW_KEY);
  if (row === null) return;
  const prev = everSyncedCodec.decode(row);
  if (prev === undefined) return;
  const next: Record<string, true> = { ...prev };
  delete next[sessionKey];
  if (Object.keys(next).length === 0) {
    await kv.zap(EVER_SYNCED_ROW_KEY);
    return;
  }
  await kv.put(EVER_SYNCED_ROW_KEY, everSyncedCodec.encode(next));
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
      void clearEverSyncedFromKv(args.kv, args.sessionKey);
    },
  };
}
