import type { RoomError, RoomState } from '@pkgs/room-root-shared/types';
import { RoomMetaAttr } from './room-meta';

const IS_SYNCED_KEY = RoomMetaAttr.isSynced.key;
const IS_CONNECTED_KEY = RoomMetaAttr.isConnected.key;
const LAST_ERROR_KEY = RoomMetaAttr.lastError.key;

/**
 * Inputs captured at `notify()` time plus the last built snapshot. The
 * snapshot object is rebuilt only when an input changed, so an unchanged
 * `getSnapshot()` returns the same reference (Solid skips downstream work).
 */
export type SnapshotCache<S extends RoomState> = {
  display: S | null;
  synced: boolean;
  connected: boolean;
  lastError: RoomError | Error | null;
  built: S | null;
  builtFrom: S | null;
  builtSynced: boolean;
  builtConnected: boolean;
  builtError: RoomError | Error | null;
  readonly freeze: boolean;
};

export function createSnapshotCache<S extends RoomState>(
  freeze: boolean
): SnapshotCache<S> {
  return {
    display: null,
    synced: false,
    connected: false,
    lastError: null,
    built: null,
    builtFrom: null,
    builtSynced: false,
    builtConnected: false,
    builtError: null,
    freeze,
  };
}

function isCurrent<S extends RoomState>(c: SnapshotCache<S>): boolean {
  return (
    c.built !== null &&
    c.builtFrom === c.display &&
    c.builtSynced === c.synced &&
    c.builtConnected === c.connected &&
    c.builtError === c.lastError
  );
}

/** Flat display state merged with the `room/*` client meta keys. */
export function readSnapshot<S extends RoomState>(c: SnapshotCache<S>): S {
  if (isCurrent(c)) return c.built as S;
  const display = c.display as S;
  const merged = { ...(display as Record<string, unknown>) };
  merged[IS_SYNCED_KEY] = RoomMetaAttr.isSynced.parse(c.synced);
  merged[IS_CONNECTED_KEY] = RoomMetaAttr.isConnected.parse(c.connected);
  merged[LAST_ERROR_KEY] = RoomMetaAttr.lastError.parse(c.lastError);
  const built = (c.freeze ? Object.freeze(merged) : merged) as unknown as S;
  c.built = built;
  c.builtFrom = display;
  c.builtSynced = c.synced;
  c.builtConnected = c.connected;
  c.builtError = c.lastError;
  return built;
}
