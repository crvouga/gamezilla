/**
 * Server-authoritative room: shared types for client + server.
 * Tiger Style: invalid shapes surface as validation errors, not silent coercions.
 */
import { asKeyword, type Keyword } from '@gamezilla/lib/keyword';
import type { Message } from '@gamezilla/lib/message';

export type { Keyword };

/**
 * Serializable room state (module-owned flat map).
 * Keys MUST be {@link Keyword}s (validated at every boundary). Domain modules add
 * keys via {@link @gamezilla/lib/attribute}; the client also adds `room/*` via {@link RoomMetaAttr}.
 */
export type RoomState = Record<Keyword, unknown>;

/** Client intent payload: wire-valid {@link Message} envelope (`isMessageEnvelope` on the server). */
export type RoomCommandPayload = Message;

/** Fact emitted by the server after a successful handle: wire-valid {@link Message} envelope. */
export type RoomEvent = Message;

export type RoomCommand<C extends RoomCommandPayload = RoomCommandPayload> = {
  id: string;
  ts: number;
  payload: C;
};

export type LogEntry<E extends RoomEvent = RoomEvent> = {
  seq: number;
  event: E;
};

/**
 * Canonical {@link RoomError} type tags as Clojure-style namespaced keywords.
 * Wire-stable: persisted snapshots, reject envelopes, and client UI all key
 * off these constants. Never inline the raw string.
 */
export const ROOM_ERROR_TYPE = {
  invalidCommand: asKeyword('room.error/invalid-command'),
  unauthorized: asKeyword('room.error/unauthorized'),
  conflict: asKeyword('room.error/conflict'),
  rateLimited: asKeyword('room.error/rate-limited'),
  internal: asKeyword('room.error/internal'),
} as const;

/** Set of all valid {@link RoomError} type keywords; use to validate ingress. */
export const ROOM_ERROR_TYPES: ReadonlySet<Keyword> = new Set<Keyword>([
  ROOM_ERROR_TYPE.invalidCommand,
  ROOM_ERROR_TYPE.unauthorized,
  ROOM_ERROR_TYPE.conflict,
  ROOM_ERROR_TYPE.rateLimited,
  ROOM_ERROR_TYPE.internal,
]);

export type RoomError =
  | { type: typeof ROOM_ERROR_TYPE.invalidCommand; reason: string }
  | { type: typeof ROOM_ERROR_TYPE.unauthorized; reason: string }
  | { type: typeof ROOM_ERROR_TYPE.conflict; reason: string }
  | { type: typeof ROOM_ERROR_TYPE.rateLimited }
  | { type: typeof ROOM_ERROR_TYPE.internal; reason?: string };

export type HandleResult<E extends RoomEvent = RoomEvent> =
  | { ok: true; events: E[] }
  | { ok: false; error: RoomError };

export type RoomModule<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
  Identity = unknown,
> = {
  initialState(): S;
  handle(
    state: S,
    command: RoomCommand<C>,
    identity: Identity
  ): HandleResult<E>;
  reduce(state: S, event: E): S;
};
