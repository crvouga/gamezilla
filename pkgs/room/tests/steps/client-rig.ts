/**
 * A `RoomClient` on the cursor module over a fake transport the steps play
 * the server through, counting storage, and ports whose timers fire only
 * when told. Alice is the person on the device.
 */

import type { Message } from '@pkgs/message';
import {
  type LogEntry,
  ROOM_WIRE_KIND,
  RoomClient,
  type RoomState,
  WIRE_VERSION,
} from '@pkgs/room';
import { CursorModule, Moved } from '../helpers/cursor-module';
import { FakeTransport } from '../helpers/fake-transport';
import { CountingClientStorage } from '../helpers/memory-storage';
import { testPorts } from '../helpers/ports';

export const ACTOR = { id: 'alice', clientId: 'tab' } as const;

export type Vec = { readonly x: number; readonly y: number };

export type ClientRig = {
  readonly room: RoomClient<RoomState, Message, Message, string>;
  readonly transport: FakeTransport;
  readonly storage: CountingClientStorage;
  readonly errors: unknown[];
  readonly fireTimers: () => void;
  /** Times the module handled a command (optimistic applies and replays). */
  readonly handles: () => number;
  /** Where each of alice's moves went, in dispatch order. */
  readonly moves: Vec[];
};

export async function openClient(
  storage = new CountingClientStorage()
): Promise<ClientRig> {
  const ports = testPorts();
  const transport = new FakeTransport();
  const errors: unknown[] = [];
  let handles = 0;
  const module = {
    ...CursorModule,
    handle: (...args: Parameters<typeof CursorModule.handle>) => {
      handles += 1;
      return CursorModule.handle(...args);
    },
  };
  const room = await RoomClient.open<RoomState, Message, Message, string>({
    topic: 't',
    module,
    storage,
    transport,
    identity: ACTOR.id,
    clock: ports.clock,
    timers: ports.timers,
    createId: ports.createId,
    onError: (error) => {
      errors.push(error);
    },
  });
  return {
    room,
    transport,
    storage,
    errors,
    fireTimers: ports.fire,
    handles: () => handles,
    moves: [],
  };
}

export function movedEntry(seq: number, id: string, at: Vec): LogEntry {
  return { seq, event: Moved({ id, x: at.x, y: at.y }), actor: ACTOR, ts: 1 };
}

export function welcome(
  entries: readonly LogEntry[],
  lastSeq = entries.at(-1)?.seq ?? 0
) {
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.welcome,
    fromSeq: 0,
    lastSeq,
    entries,
  };
}

export function committed(entries: readonly LogEntry[], commandId?: string) {
  return commandId === undefined
    ? { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.committed, entries }
    : { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.committed, commandId, entries };
}

/** The command frames the client sent, oldest first. */
export function sentCommands(rig: ClientRig): readonly { id: string }[] {
  return rig.transport.sent.filter(
    (f) => (f as { kind: string }).kind === ROOM_WIRE_KIND.command
  ) as { id: string }[];
}

/** The id of alice's `n`th command (1-based). */
export function commandId(rig: ClientRig, n: number): string {
  const sent = sentCommands(rig)[n - 1];
  if (sent === undefined) throw new Error(`alice has not sent command ${n}`);
  return sent.id;
}

export function nextSeq(rig: ClientRig): number {
  return rig.room.getLastSeq() + 1;
}
