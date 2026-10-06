/**
 * Server-authoritative room: shared types for client + server.
 * Tiger Style: invalid shapes surface as validation errors, not silent coercions.
 */

import type { Keyword } from '@pkgs/keyword-shared/keyword';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import type { Message } from '@pkgs/message-shared/message';

/**
 * Serializable room state (module-owned flat map).
 * Keys MUST be {@link Keyword}s (validated at every boundary). Domain modules add
 * keys via {@link @pkgs/attribute-shared}; the client also adds `room/*` via {@link RoomMetaAttr}.
 */
export type RoomState = Record<Keyword, unknown>;

/** Client intent payload: wire-valid {@link Message} envelope (`isMessageEnvelope` on the server). */
export type RoomCommandPayload = Message;

/** Fact emitted by the server after a successful handle: wire-valid {@link Message} envelope. */
export type RoomEvent = Message;

/**
 * Side-effect intent from {@link RoomModule.handle}. Message envelope like
 * commands/events; not part of the committed event log. Built-ins live under
 * `room-effect/*` (Schedule / CancelSchedule); callers may emit custom effects
 * handled by injected {@link RoomEffectHandler}s.
 */
export type RoomEffect = Message;

export type RoomCommand<C extends RoomCommandPayload = RoomCommandPayload> = {
  id: string;
  ts: number;
  payload: C;
};

/**
 * Who is connected / who authored a committed log entry.
 * `id` is the stable app-level participant (account or device);
 * `clientId` is one per tab / app instance so the same participant can
 * appear multiple times in the live roster.
 */
export type RoomActor = {
  readonly id: string;
  readonly clientId: string;
};

export type LogEntry<E extends RoomEvent = RoomEvent> = {
  seq: number;
  event: E;
  /** Absent on entries written before actor metadata existed. */
  actor?: RoomActor;
  /** Server commit time, epoch ms. Absent on legacy entries. */
  ts?: number;
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
  | { ok: true; events: E[]; effects?: readonly RoomEffect[] }
  | { ok: false; error: RoomError };

/**
 * Wire-safe room-module id: lowercase ASCII letters with single-hyphen
 * separators between segments (`space`, `chess-lobby`). No spaces, digits,
 * underscores, or consecutive hyphens.
 */
export const ROOM_MODULE_NAME_REGEX = /^[a-z]+(?:-[a-z]+)*$/;

declare const roomModuleNameBrand: unique symbol;

/** Branded module id validated by {@link parseRoomModuleName} / {@link assertRoomModuleName}. */
export type RoomModuleName = string & { readonly [roomModuleNameBrand]: true };

export function parseRoomModuleName(raw: string): RoomModuleName | null {
  const t = raw.trim();
  if (!ROOM_MODULE_NAME_REGEX.test(t)) return null;
  return t as RoomModuleName;
}

export function assertRoomModuleName(raw: string): RoomModuleName {
  const parsed = parseRoomModuleName(raw);
  if (parsed === null) {
    throw new Error(
      `invalid room module name: ${JSON.stringify(raw)} — expected lowercase kebab-case letters only (e.g. "space", "chess-lobby")`
    );
  }
  return parsed;
}

export type RoomModule<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
  Identity = unknown,
> = {
  /** Wire id for DO routing (`module` query) and uniqueness in multi-module hosts. */
  readonly name: RoomModuleName;
  initialState(): S;
  handle(
    state: S,
    command: RoomCommand<C>,
    identity: Identity
  ): HandleResult<E>;
  reduce(state: S, event: E): S;
  /** Restore idempotent effects from committed state, preserving original deadlines. */
  recoverEffects(state: S): readonly RoomEffect[];
  /**
   * Canonical digest of synced state for reconnect / replay / anti-cheat.
   * Must cover the full attribute map clients need to match. Prefer
   * `hashRoomState` unless the module needs a narrower projection.
   */
  hash(state: S): string;
  /**
   * The command to commit when who is connected changes (presence), or
   * `null` when the change means nothing to the module. Evaluated on the
   * room's serial chain with the distinct ids of the connected actors; it is
   * injected as `ROOM_PRESENCE_IDENTITY` (`@pkgs/room-root-shared/builtin`).
   */
  presenceCommand?(state: S, present: readonly string[]): C | null;
};
