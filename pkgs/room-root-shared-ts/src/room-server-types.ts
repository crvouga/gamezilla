import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { RoomEffectHandler } from './handler';
import type { RoomStorage } from './server-core-storage';
import type {
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomEffect,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from './types';
import type { ClientToServerWire } from './wire';
import { ROOM_WIRE_KIND, WIRE_VERSION } from './wire';

export type RoomServerConfig<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
> = {
  topic: string;
  module: RoomModule<S, C, E, Identity>;
  storage: RoomStorage;
  /**
   * Per-command gate, run before `handle` (injected commands included).
   * `grants` are the opaque grants the sender's connection was admitted with
   * ({@link RoomConnectionOptions.grants}) — whatever the host in front of
   * the room decided at upgrade; a socket-less (injected) command has none.
   * A refusal rejects the command as `unauthorized`, never logged.
   */
  authorize?: (
    identity: Identity,
    topic: string,
    command: RoomCommand<C>,
    grants: readonly string[]
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  clock: Clock;
  /** Required when live execution actually uses scheduled work, not for other games in its registry. */
  timers?: Timers;
  onError?: (error: unknown) => void;
  effectHandlers?: readonly RoomEffectHandler[];
};

type Sender = (payload: unknown) => void;

export type RoomConnection = {
  readonly id: string;
  readonly send: Sender;
  readonly actor: RoomActor;
  readonly view: import('./types').RoomConnectionView;
  /** Opaque grants the connection was admitted with (never broadcast). */
  readonly grants: readonly string[];
};

export type RoomConnectionOptions = {
  /** Skip the roster broadcast (bulk re-attach after hibernation). */
  readonly silent?: boolean;
  /**
   * Opaque grants decided by the host in front of the room when it admitted
   * the connection (e.g. an API gateway); handed to `authorize` with every
   * command the connection sends. Default: none.
   */
  readonly grants?: readonly string[];
};

export const NO_GRANTS: readonly string[] = Object.freeze([]);

export type CommandFrame = Extract<
  ClientToServerWire,
  { kind: typeof ROOM_WIRE_KIND.command }
>;

export type CommitArgs<E extends RoomEvent> = {
  readonly actor: RoomActor;
  readonly commandId: string;
  readonly events: E[];
  readonly effects: readonly RoomEffect[];
};

export const PONG_FRAME = Object.freeze({
  v: WIRE_VERSION,
  kind: ROOM_WIRE_KIND.pong,
});

export function rejectedFrame(commandId: string, error: RoomError): unknown {
  return { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.rejected, commandId, error };
}
