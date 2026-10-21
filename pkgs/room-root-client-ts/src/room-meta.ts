import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import type { Keyword } from '@pkgs/keyword-shared-ts/keyword';
import type { RoomError } from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPES } from '@pkgs/room-root-shared-ts/types';

/** Namespace for client-only `room/*` snapshot keys; use {@link roomAttrNamespace.ownsKey}. */
export const roomAttrNamespace = createAttrNamespace('room');

const readBoolean = (v: unknown): boolean =>
  typeof v === 'boolean' ? v : false;

function isRoomError(v: unknown): v is RoomError {
  if (typeof v !== 'object' || v === null) return false;
  if (!('type' in v)) return false;
  const t = (v as { type: unknown }).type;
  return typeof t === 'string' && ROOM_ERROR_TYPES.has(t as Keyword);
}

const readRoomErrorOrNull = (v: unknown): RoomError | Error | null => {
  if (v === null || v === undefined) return null;
  if (isRoomError(v)) return v;
  if (v instanceof Error) return v;
  return null;
};

/**
 * Client-only metadata merged into {@link RoomClient.getSnapshot} flat state.
 * Domain module state must not use the `room/` prefix.
 *
 * `last-error` carries a `RoomError | Error | null` shape. We declare it as
 * `jsonOrNull` because the snapshot is in-memory only — the entity store never
 * serializes it. The parser is typed externally; the cast just satisfies the
 * `Record<string, unknown>` shape ceiling on `json` tags (Error instances
 * structurally fit `Record<string, unknown>` after the parser returns).
 */
type RoomErrorJson = Record<string, unknown>;

const readRoomErrorOrNullJson = (v: unknown): RoomErrorJson | null =>
  readRoomErrorOrNull(v) as RoomErrorJson | null;

export const RoomMetaAttr = {
  isSynced: roomAttrNamespace.boolean('is-synced', readBoolean),
  isConnected: roomAttrNamespace.boolean('is-connected', readBoolean),
  hasRoster: roomAttrNamespace.boolean('has-roster', readBoolean),
  lastError: roomAttrNamespace.jsonOrNull(
    'last-error',
    readRoomErrorOrNullJson
  ),
} as const;
