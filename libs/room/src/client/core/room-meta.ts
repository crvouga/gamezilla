import { createAttrNamespace } from '@gamezilla/lib/attribute';

import type { RoomError } from '../../types';

/** Namespace for client-only `room/*` snapshot keys; use {@link roomAttrNamespace.ownsKey}. */
export const roomAttrNamespace = createAttrNamespace('room');

const readBoolean = (v: unknown): boolean =>
  typeof v === 'boolean' ? v : false;

function isRoomError(v: unknown): v is RoomError {
  if (typeof v !== 'object' || v === null) return false;
  if (!('type' in v)) return false;
  const t = (v as { type: unknown }).type;
  return (
    t === 'invalid_command' ||
    t === 'unauthorized' ||
    t === 'conflict' ||
    t === 'rate_limited' ||
    t === 'internal'
  );
}

const readRoomErrorOrNull = (v: unknown): RoomError | Error | null => {
  if (v === null || v === undefined) return null;
  if (isRoomError(v)) return v;
  if (v instanceof Error) return v;
  return null;
};

/**
 * Client-only metadata merged into {@link Room.getSnapshot} flat state.
 * Domain module state must not use the `room/` prefix.
 */
export const RoomMetaAttr = {
  isSynced: roomAttrNamespace('is-synced', readBoolean),
  isConnected: roomAttrNamespace('is-connected', readBoolean),
  lastError: roomAttrNamespace('last-error', readRoomErrorOrNull),
} as const;
