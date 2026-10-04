/**
 * A `RoomClient` on the example game room over a fake transport the test
 * plays the server through, counting storage, and ports whose timers fire
 * only when told. Alice is the person on the device.
 */

import type { Message } from '@pkgs/message-shared/message';
import type { LogEntry, RoomState } from '@pkgs/room-shared/types';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-shared/wire';
import { RoomClient } from '@pkgs/room-client/room-client';
import { AddOne, gameRoomModule, TakeOne, TallyChanged } from '@pkgs/room-harness/game-room';
import { FakeTransport } from './fake-transport';
import { CountingClientStorage } from './memory-storage';
import { testPorts } from './ports';

export const ACTOR = { id: 'alice', clientId: 'tab' } as const;

/** One change to the tally: add one or take one off. */
export type Change = 1 | -1;

export type ClientRig = {
  readonly room: RoomClient<RoomState, Message, Message, string>;
  readonly transport: FakeTransport;
  readonly storage: CountingClientStorage;
  readonly errors: unknown[];
  readonly fireTimers: () => void;
  /** Times the module handled a command (optimistic applies and replays). */
  readonly handles: () => number;
  /** Each of alice's changes to the tally, in dispatch order. */
  readonly changes: Change[];
};

export async function openClient(
  storage = new CountingClientStorage()
): Promise<ClientRig> {
  const ports = testPorts();
  const transport = new FakeTransport();
  const errors: unknown[] = [];
  let handles = 0;
  const module = {
    ...gameRoomModule,
    handle: (...args: Parameters<typeof gameRoomModule.handle>) => {
      handles += 1;
      return gameRoomModule.handle(...args);
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
    changes: [],
  };
}

/** Alice changes the tally on her device. */
export function change(rig: ClientRig, by: Change): void {
  rig.changes.push(by);
  rig.room.dispatch(by === 1 ? AddOne({}) : TakeOne({}));
}

/** A committed log entry: `person` changed the tally `by`. */
export function tallyEntry(seq: number, person: string, by: number): LogEntry {
  return {
    seq,
    event: TallyChanged({ by }),
    actor: { id: person, clientId: person },
    ts: 1,
  };
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
