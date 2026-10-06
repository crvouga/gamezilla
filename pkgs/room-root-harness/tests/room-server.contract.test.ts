/**
 * Contract: `RoomServer` wire frames, log rows, dedup memory and the
 * authorize hook, driven over recording connections on the example game
 * room. The room behavior people see
 * (changes reach everyone, count once, survive a restart; presence) is
 * stated in `specs/room/`; this file pins the frames and rows under it.
 */

import { describe, expect, test } from 'bun:test';
import {
  AddOne,
  gameRoomModule,
  readTally,
} from '@pkgs/room-root-harness/game-room';
import { MAX_WELCOME_ENTRIES_PER_FRAME } from '@pkgs/room-root-shared/bounds';
import { ROOM_PRESENCE_IDENTITY } from '@pkgs/room-root-shared/builtin';
import type { LogEntry } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { WIRE_VERSION } from '@pkgs/room-root-shared/wire';
import type { ServerRig, StartServerOpts } from './server-rig';
import {
  addOneCommand,
  connection,
  connectPerson,
  framesOfKind,
  startServer,
} from './server-rig';

async function send(
  rig: ServerRig,
  person: string,
  frame: unknown
): Promise<void> {
  await rig.server.handleClientMessage(person, person, frame);
}

async function sendAddOne(rig: ServerRig, person: string, id: string) {
  await send(rig, person, addOneCommand(id));
}

function tally(rig: ServerRig): number {
  return readTally(rig.server.getCommittedState());
}

function committed(rig: ServerRig, person: string) {
  return framesOfKind(connection(rig, person).frames, 'committed') as {
    readonly entries: readonly LogEntry[];
  }[];
}

function logSeqs(rig: ServerRig): readonly number[] {
  return rig.storage.entries.map((e) => e.seq);
}

async function serverWith(
  people: readonly string[],
  opts: StartServerOpts = {}
): Promise<ServerRig> {
  const rig = await startServer(opts);
  for (const person of people) connectPerson(rig, person);
  return rig;
}

describe('room server: commits reach every connection', () => {
  test('each commit is one shared frame object sent to every connection', async () => {
    const rig = await serverWith(['alice', 'bob']);
    await sendAddOne(rig, 'alice', 'c1');
    await sendAddOne(rig, 'bob', 'c2');
    expect(committed(rig, 'alice')).toHaveLength(2);
    expect(committed(rig, 'bob')).toHaveLength(2);
    expect(committed(rig, 'alice')[0]).toBeDefined();
    expect(committed(rig, 'bob')[0]).toBe(committed(rig, 'alice')[0]);
    expect(logSeqs(rig)).toEqual([1, 2]);
    expect(tally(rig)).toBe(2);
  });

  test('the log tip stays in memory: committing never re-reads it', async () => {
    const rig = await serverWith(['alice', 'bob']);
    await sendAddOne(rig, 'alice', 'c1');
    await sendAddOne(rig, 'bob', 'c2');
    expect(rig.storage.lastSeqReads).toBe(rig.tipReadsAtStart);
  });
});

describe('room server: a command id applies once', () => {
  test('a resent command id replays the first committed frame', async () => {
    const rig = await serverWith(['alice']);
    await sendAddOne(rig, 'alice', 'dup');
    await sendAddOne(rig, 'alice', 'dup');
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
        payload: AddOne({}),
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
    await send(rig, 'alice', { ...addOneCommand('bad'), payload: 'garbage' });
    await send(rig, 'alice', {
      ...addOneCommand('unknown'),
      payload: { type: 'game-room-cmd/teleport', payload: {} },
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
    expect(tally(rig)).toBe(0);
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
      await sendAddOne(rig, 'alice', `c${String(i)}`);
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
    await sendAddOne(first, 'alice', 'c1');
    const rig = await startServer({ storage: first.storage });
    expect(tally(rig)).toBe(1);
  });

  test('a restarted server continues the log sequence where it stopped', async () => {
    const first = await serverWith(['alice']);
    await sendAddOne(first, 'alice', 'c1');
    const rig = await startServer({ storage: first.storage });
    connectPerson(rig, 'bob');
    await sendAddOne(rig, 'bob', 'c2');
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

describe('room server: presence', () => {
  test('a module commits what a change of who is connected means to it, as the room engine', async () => {
    const seen: (readonly string[])[] = [];
    const rig = await startServer({
      module: {
        ...gameRoomModule,
        presenceCommand: (_state, present) => {
          seen.push(present);
          return present.length === 0 ? AddOne({}) : null;
        },
      },
    });
    connectPerson(rig, 'bob');
    await rig.server.readCommittedState();
    rig.server.unregisterConnection('bob');
    await rig.server.readCommittedState();
    expect(seen).toEqual([['bob'], []]);
    expect(tally(rig)).toBe(1);
    expect(rig.storage.entries.map((e) => e.actor?.id)).toEqual([
      ROOM_PRESENCE_IDENTITY,
    ]);
  });
});

describe('room server: the authorize hook', () => {
  const turnAwayEve: StartServerOpts = {
    authorize: async (identity) =>
      identity === 'eve' ? { ok: false, reason: 'turned away' } : { ok: true },
  };

  test('a denied command is refused as unauthorized and never logged', async () => {
    const rig = await serverWith(['alice', 'eve'], turnAwayEve);
    await sendAddOne(rig, 'eve', 'e1');
    const refusals = framesOfKind(
      connection(rig, 'eve').frames,
      'rejected'
    ) as {
      readonly error: { readonly type: string; readonly reason: string };
    }[];
    expect(refusals.map((f) => f.error)).toEqual([
      { type: ROOM_ERROR_TYPE.unauthorized, reason: 'turned away' },
    ]);
    expect(rig.storage.entries).toHaveLength(0);
    expect(tally(rig)).toBe(0);
  });

  test('an allowed command still commits beside a denied one', async () => {
    const rig = await serverWith(['alice', 'eve'], turnAwayEve);
    await sendAddOne(rig, 'eve', 'e1');
    await sendAddOne(rig, 'alice', 'a1');
    expect(logSeqs(rig)).toEqual([1]);
    expect(tally(rig)).toBe(1);
  });

  test('an injected command is authorized under its identity too', async () => {
    const rig = await serverWith(['alice'], turnAwayEve);
    await rig.server.injectCommand({
      id: 'i1',
      payload: AddOne({}),
      identity: 'eve',
    });
    expect(rig.storage.entries).toHaveLength(0);
  });
});

describe('room server: grants the connection was admitted with', () => {
  const tallyKeepers: StartServerOpts = {
    authorize: async (_identity, _topic, _command, grants) =>
      grants.includes('tally')
        ? { ok: true }
        : { ok: false, reason: 'not a tally keeper' },
  };

  test('reach the authorize hook with every command the connection sends', async () => {
    const rig = await startServer(tallyKeepers);
    connectPerson(rig, 'alice', ['tally']);
    connectPerson(rig, 'bob');
    await sendAddOne(rig, 'alice', 'a1');
    await sendAddOne(rig, 'bob', 'b1');
    expect(logSeqs(rig)).toEqual([1]);
    expect(
      framesOfKind(connection(rig, 'bob').frames, 'rejected')
    ).toHaveLength(1);
  });

  test('are never broadcast in the roster', async () => {
    const rig = await startServer(tallyKeepers);
    connectPerson(rig, 'alice', ['tally']);
    expect(rig.server.getRoster()).toEqual([
      { id: 'alice', clientId: 'alice' },
    ]);
  });

  test('an injected command carries none', async () => {
    const rig = await startServer(tallyKeepers);
    connectPerson(rig, 'alice', ['tally']);
    await rig.server.injectCommand({
      id: 'i1',
      payload: AddOne({}),
      identity: 'alice',
    });
    expect(rig.storage.entries).toHaveLength(0);
  });
});
