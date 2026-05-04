/**
 * Server-authoritative room: shared types for client + server.
 * Tiger Style: invalid shapes surface as validation errors, not silent coercions.
 */

/** Serializable room state (module-owned shape). */
export type RoomState = Record<string, unknown>;

/** Client intent payload (e.g. namespaced message from @gamezilla/lib/message). */
export type RoomCommandPayload = unknown;

/** Fact emitted by the server after a successful handle. */
export type RoomEvent = unknown;

export type RoomCommand<C = RoomCommandPayload> = {
  id: string;
  ts: number;
  payload: C;
};

export type LogEntry<E = RoomEvent> = {
  seq: number;
  event: E;
};

export type RoomError =
  | { type: 'invalid_command'; reason: string }
  | { type: 'unauthorized'; reason: string }
  | { type: 'conflict'; reason: string }
  | { type: 'rate_limited' }
  | { type: 'internal'; reason?: string };

export type HandleResult<E = RoomEvent> =
  | { ok: true; events: E[] }
  | { ok: false; error: RoomError };

export type RoomModule<
  S extends RoomState = RoomState,
  C = RoomCommandPayload,
  E = RoomEvent,
  Identity = unknown,
> = {
  initialState(): S;
  handle(state: S, command: RoomCommand<C>, identity: Identity): HandleResult<E>;
  reduce(state: S, event: E): S;
};
