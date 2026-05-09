/**
 * Server-authoritative room: shared types for client + server.
 * Tiger Style: invalid shapes surface as validation errors, not silent coercions.
 */
import type { Keyword } from '@gamezilla/lib/keyword';
import type { Message } from '@gamezilla/lib/message';

export type { Keyword };

/**
 * Serializable room state (module-owned flat map).
 * Keys should come from {@link @gamezilla/lib/attribute} tags; client adds `room/*` via {@link RoomMetaAttr}.
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

export type RoomError =
  | { type: 'invalid_command'; reason: string }
  | { type: 'unauthorized'; reason: string }
  | { type: 'conflict'; reason: string }
  | { type: 'rate_limited' }
  | { type: 'internal'; reason?: string };

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
