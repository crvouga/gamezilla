/**
 * Contract: `RoomServer` wire frames, log rows and dedup memory, driven over
 * recording connections on the cursor module. The room behavior people see
 * (changes reach everyone, count once, survive a restart; presence) is
 * stated in `specs/rooms/`; this file pins the frames and rows under it.
 */

import { describe, expect, test } from 'bun:test';
import {
  type LogEntry,
  MAX_WELCOME_ENTRIES_PER_FRAME,
  ROOM_ERROR_TYPE,
  WIRE_VERSION,
} from '@pkgs/room';
import { MOVES_KEY, Move } from './helpers/cursor-module';
import {
  connection,
  connectPerson,
  framesOfKind,
  moveCommand,
  type ServerRig,
  startServer,
} from './helpers/server-rig';

async function send(
  rig: ServerRig,
  person: string,
  frame: unknown
): Promise<void> {
  await rig.server.handleClientMessage(person, person, frame);
}

async function sendMove(rig: ServerRig, person: string, id: string) {
  await send(rig, person, moveCommand(id));
}

function committed(rig: ServerRig, person: string) {
  return framesOfKind(connection(rig, person).frames, 'committed') as {
    readonly entries: readonly LogEntry[];
  }[];
}

function logSeqs(rig: ServerRig): readonly number[] {
  return rig.storage.entries.map((e) => e.seq);
}

async function serverWith(people: readonly string[]): Promise<ServerRig> {
  const rig = await startServer();
  for (const person of people) connectPerson(rig, person);
  return rig;
}

describe('room server: commits reach every connection', () => {
  test('each commit is one shared frame object sent to every connection', async () => {
    const rig = await serverWith(['alice', 'bob']);
    await sendMove(rig, 'alice', 'c1');
    await sendMove(rig, 'bob', 'c2');
    expect(committed(rig, 'alice')).toHaveLength(2);
    expect(committed(rig, 'bob')).toHaveLength(2);
    expect(committed(rig, 'alice')[0]).toBeDefined();
    expect(committed(rig, 'bob')[0]).toBe(committed(rig, 'alice')[0]);
    expect(logSeqs(rig)).toEqual([1, 2]);
    expect(rig.server.getCommittedState()[MOVES_KEY]).toBe(2);
  });

  test('the log tip stays in memory: committing never re-reads it', async () => {
    const rig = await serverWith(['alice', 'bob']);
    await sendMove(rig, 'alice', 'c1');
    await sendMove(rig, 'bob', 'c2');
    expect(rig.storage.lastSeqReads).toBe(rig.tipReadsAtStart);
  });
});

describe('room server: a command id applies once', () => {
  test('a resent command id replays the first committed frame', async () => {
    const rig = await serverWith(['alice']);
    await sendMove(rig, 'alice', 'dup');
    await sendMove(rig, 'alice', 'dup');
    expect(rig.storage.entries).toHaveLength(1);
    expect(committed(rig, 'alice')).toHaveLength(2);
    expect(
      committed(rig, 'alice')
        .at(-1)
        ?.entries.map((e) => e.seq)
    ).toEqual([1]);
  });

  test('an injected command id applies once, as the scheduler', async () => {
    const rig = await serverWith(['alice']);
    const inject = () =>
      rig.server.injectCommand({
        id: 'i1',
        payload: Move({ x: 3, y: 3 }),
        identity: 'room:scheduler',
      });
    await inject();
    await inject();
    expect(rig.storage.entries).toHaveLength(1);
    expect(rig.storage.entries.find((e) => e.seq === 1)?.actor).toEqual({
      id: 'room:scheduler',
      clientId: 'scheduler',
    });
    expect(committed(rig, 'alice')).toHaveLength(1);
  });
});

describe('room server: invalid commands are refused', () => {
  test('a non-message payload and an unknown command type are refused, remembered, and never logged', async () => {
    const rig = await serverWith(['alice']);
    await send(rig, 'alice', { ...moveCommand('bad'), payload: 'garbage' });
    await send(rig, 'alice', {
      ...moveCommand('unknown'),
      payload: { type: 'cursor-cmd/teleport', payload: {} },
    });
    const refusals = framesOfKind(
      connection(rig, 'alice').frames,
      'rejected'
    ) as { readonly error: { readonly type: string } }[];
    expect(refusals.map((f) => f.error.type)).toEqual([
      ROOM_ERROR_TYPE.invalidCommand,
      ROOM_ERROR_TYPE.invalidCommand,
    ]);
    expect(rig.storage.dedup.get('bad')?.kind).toBe('rejected');
    expect(rig.storage.entries).toHaveLength(0);
  });

  test('a frame of unknown kind is ignored: no answer, nothing logged', async () => {
    const rig = await serverWith(['alice']);
    const before = connection(rig, 'alice').frames.length;
    await send(rig, 'alice', { v: WIRE_VERSION, kind: 'nope' });
    expect(connection(rig, 'alice').frames).toHaveLength(before);
    expect(rig.storage.entries).toHaveLength(0);
    expect(rig.server.getCommittedState()[MOVES_KEY]).toBe(0);
  });
});

describe('room server: connections are answered', () => {
  test('a ping is answered with a pong', async () => {
    const rig = await serverWith(['alice']);
    await send(rig, 'alice', { v: WIRE_VERSION, kind: 'ping' });
    expect(connection(rig, 'alice').frames.at(-1)).toEqual({
      v: WIRE_VERSION,
      kind: 'pong',
    });
  });

  test('a sync from 0 sends a capped welcome naming the true tip, then the roster', async () => {
    const rig = await serverWith(['alice']);
    const extra = 5;
    for (let i = 0; i < MAX_WELCOME_ENTRIES_PER_FRAME + extra; i += 1) {
      await sendMove(rig, 'alice', `c${String(i)}`);
    }
    const from = connection(rig, 'alice').frames.length;
    await send(rig, 'alice', { v: WIRE_VERSION, kind: 'sync', fromSeq: 0 });
    const [welcome, next] = connection(rig, 'alice').frames.slice(from) as {
      readonly kind: string;
      readonly lastSeq?: number;
      readonly entries?: readonly LogEntry[];
    }[];
    expect(welcome?.kind).toBe('welcome');
    expect(welcome?.entries).toHaveLength(MAX_WELCOME_ENTRIES_PER_FRAME);
    expect(welcome?.lastSeq).toBe(MAX_WELCOME_ENTRIES_PER_FRAME + extra);
    expect(next?.kind).toBe('roster');
  });
});

describe('room server: restart from storage', () => {
  test('a restarted server rebuilds its committed state from the log', async () => {
    const first = await serverWith(['alice']);
    await sendMove(first, 'alice', 'c1');
    const rig = await startServer(first.storage);
    expect(rig.server.getCommittedState()[MOVES_KEY]).toBe(1);
  });

  test('a restarted server continues the log sequence where it stopped', async () => {
    const first = await serverWith(['alice']);
    await sendMove(first, 'alice', 'c1');
    const rig = await startServer(first.storage);
    connectPerson(rig, 'bob');
    await sendMove(rig, 'bob', 'c2');
    expect(logSeqs(rig)).toEqual([1, 2]);
  });
});

describe('room server: roster', () => {
  test('a connection joins the roster as its actor', async () => {
    const rig = await startServer();
    connectPerson(rig, 'bob');
    expect(rig.server.getRoster()).toEqual([{ id: 'bob', clientId: 'bob' }]);
  });

  test('a closed connection leaves the roster and is sent no roster after it', async () => {
    const rig = await serverWith(['bob']);
    rig.server.unregisterConnection('bob');
    expect(rig.server.getRoster()).toEqual([]);
    expect(framesOfKind(connection(rig, 'bob').frames, 'roster')).toHaveLength(
      1
    );
  });
});
