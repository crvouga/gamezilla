/**
 * A private event leaves the room only for its audience: every other
 * connection receives the entry withheld, on commit, on a later welcome and
 * on a retried command alike, and its copy of the room keeps no trace of it.
 */

import { expect, test } from 'bun:test';
import { gameRoomModule } from '@pkgs/room-root-harness-ts/game-room';
import {
  NoteSealed,
  readNotes,
  SealNote,
} from '@pkgs/room-root-harness-ts/game-room-notes';
import { RoomEventWithheld } from '@pkgs/room-root-shared-ts/private-events';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { committed, openClient, welcome } from './client-rig';
import {
  addOneCommand,
  connectPerson,
  framesOfKind,
  type ServerRig,
  startServer,
} from './server-rig';

const NOTE = 'meet at the north gate';

function sealCommand(id: string, to: string): Record<string, unknown> {
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id,
    ts: 1,
    payload: SealNote({ to, text: NOTE }),
  };
}

/** Every event one connection was sent, in order. */
function eventsSent(frames: readonly unknown[]): readonly unknown[] {
  return frames.flatMap((frame) => {
    const f = frame as { kind: string; entries?: { event: unknown }[] };
    return f.entries?.map((entry) => entry.event) ?? [];
  });
}

/** Whether anything one connection was sent holds the note's words. */
function heard(frames: readonly unknown[]): boolean {
  return JSON.stringify(frames).includes(NOTE);
}

async function sealedForBob(rig: ServerRig): Promise<void> {
  await rig.server.handleClientMessage(
    'alice',
    'alice',
    sealCommand('n1', 'bob')
  );
}

test('a sealed note reaches only its reader; everyone else receives the entry withheld', async () => {
  const rig = await startServer();
  const alice = connectPerson(rig, 'alice');
  const bob = connectPerson(rig, 'bob');
  const carol = connectPerson(rig, 'carol');
  await sealedForBob(rig);
  expect(eventsSent(bob.frames)).toEqual([
    NoteSealed({ to: 'bob', text: NOTE }),
  ]);
  for (const other of [alice, carol]) {
    expect(eventsSent(other.frames)).toEqual([RoomEventWithheld({})]);
    expect(heard(other.frames)).toBe(false);
  }
  const seqs = [alice, bob, carol].map(
    (c) =>
      (
        framesOfKind(c.frames, ROOM_WIRE_KIND.committed)[0] as {
          entries: { seq: number }[];
        }
      ).entries[0]?.seq
  );
  expect(seqs).toEqual([1, 1, 1]);
  expect(readNotes(rig.server.getCommittedState(), 'bob')).toEqual([NOTE]);
});

test('someone joining after a sealed note is welcomed with it withheld', async () => {
  const rig = await startServer();
  connectPerson(rig, 'alice');
  await sealedForBob(rig);
  const dave = connectPerson(rig, 'dave');
  await rig.server.handleClientMessage('dave', 'dave', {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.sync,
    fromSeq: 0,
  });
  expect(eventsSent(dave.frames)).toEqual([RoomEventWithheld({})]);
  expect(heard(dave.frames)).toBe(false);
});

test('a retried command replays with the note still withheld from its sender', async () => {
  const rig = await startServer();
  const alice = connectPerson(rig, 'alice');
  connectPerson(rig, 'bob');
  await sealedForBob(rig);
  await sealedForBob(rig);
  expect(framesOfKind(alice.frames, ROOM_WIRE_KIND.committed)).toHaveLength(2);
  expect(heard(alice.frames)).toBe(false);
});

test('a public commit still reaches every reader as one shared frame', async () => {
  const rig = await startServer();
  const alice = connectPerson(rig, 'alice');
  const bob = connectPerson(rig, 'bob');
  await rig.server.handleClientMessage('alice', 'alice', addOneCommand('a1'));
  const [mine] = framesOfKind(alice.frames, ROOM_WIRE_KIND.committed);
  const [theirs] = framesOfKind(bob.frames, ROOM_WIRE_KIND.committed);
  expect(mine).toBe(theirs);
});

test('the leak check catches a room that forgets who may read a note', async () => {
  const { audience: _forgotten, ...careless } = gameRoomModule;
  const rig = await startServer({ module: careless });
  const alice = connectPerson(rig, 'alice');
  connectPerson(rig, 'bob');
  await sealedForBob(rig);
  expect(heard(alice.frames)).toBe(true);
});

test("a device keeps its place in the log but nothing of someone else's note", async () => {
  const rig = await openClient();
  rig.transport.deliver(welcome([]));
  rig.transport.deliver(
    committed([
      {
        seq: 1,
        event: RoomEventWithheld({}),
        actor: { id: 'bob', clientId: 'bob' },
        ts: 1,
      },
    ])
  );
  expect(rig.room.getLastSeq()).toBe(1);
  expect(readNotes(rig.room.getSnapshot(), 'bob')).toEqual([]);
  expect(rig.errors).toEqual([]);
});
