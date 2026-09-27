/** Steps for a `RoomClient`, with the steps playing its server. */

import { expect } from 'bun:test';
import {
  type LogEntry,
  MAX_PENDING_OUTBOUND_COMMANDS,
  ROOM_ERROR_TYPE,
  RoomMetaAttr,
  WIRE_VERSION,
} from '@pkgs/room';
import { Move, readMoves, readPositions } from '../helpers/cursor-module';
import { CountingClientStorage } from '../helpers/memory-storage';
import {
  ACTOR,
  type ClientRig,
  commandId,
  committed,
  movedEntry,
  nextSeq,
  openClient,
  sentCommands,
  type Vec,
  welcome,
} from './client-rig';
import {
  before,
  clientRig,
  type EngineWorld,
  Given,
  recall,
  remember,
  Then,
  When,
} from './world';

function deviceStorage(w: EngineWorld): CountingClientStorage {
  if (!w.memo.has('storage'))
    remember(w, 'storage', new CountingClientStorage());
  return recall<CountingClientStorage>(w, 'storage');
}

async function open(w: EngineWorld): Promise<ClientRig> {
  w.client = await openClient(deviceStorage(w));
  return w.client;
}

function move(rig: ClientRig, at: Vec): void {
  rig.moves.push(at);
  rig.room.dispatch(Move({ x: at.x, y: at.y }));
}

function alongX(xs: readonly number[]): readonly Vec[] {
  return xs.map((x) => ({ x, y: 0 }));
}

async function syncedWith(
  w: EngineWorld,
  bobAt: readonly Vec[]
): Promise<void> {
  const rig = await open(w);
  rig.transport.deliver(
    welcome(bobAt.map((at, i) => movedEntry(i + 1, 'bob', at)))
  );
}

function commitPredicted(rig: ClientRig, n: number): void {
  const at = rig.moves[n - 1];
  if (at === undefined) throw new Error(`alice made no move ${n}`);
  rig.transport.deliver(
    committed([movedEntry(nextSeq(rig), 'alice', at)], commandId(rig, n))
  );
}

function commitOther(rig: ClientRig, person: string, at: Vec): void {
  rig.transport.deliver(committed([movedEntry(nextSeq(rig), person, at)]));
}

// Opening and syncing

Given('{person} opens a cursor room', async (w) => {
  await open(w);
});

Given("alice's room is synced", async (w) => {
  await syncedWith(w, []);
});

Given(
  "alice's room is synced with bob's moves along x to {ints}",
  async (w, xs: number[]) => {
    await syncedWith(w, alongX(xs));
  }
);

When('the welcome arrives', (w) => {
  clientRig(w).transport.deliver(welcome([]));
});

When(
  'a welcome ending at sequence number {int} arrives',
  (w, lastSeq: number) => {
    clientRig(w).transport.deliver(welcome([], lastSeq));
  }
);

When(
  '{person} waits up to {int} ms for sync and the timer fires',
  (w, _person: string, ms: number) => {
    const rig = clientRig(w);
    w.memo.set('wait', settled(rig.room.untilSynced(ms)));
    rig.fireTimers();
  }
);

When(
  '{person} waits up to {int} ms for sync',
  (w, _person: string, ms: number) => {
    w.memo.set('wait', settled(clientRig(w).room.untilSynced(ms)));
  }
);

function settled(wait: Promise<unknown>): Promise<unknown> {
  return wait.then(
    () => 'ok',
    (error: unknown) => error
  );
}

Then('the wait fails with a timeout', async (w) => {
  const outcome = await recall<Promise<unknown>>(w, 'wait');
  expect(outcome).toBeInstanceOf(Error);
  expect((outcome as Error).message).toContain('timeout');
});

Then('the wait succeeds', async (w) => {
  expect(await recall<Promise<unknown>>(w, 'wait')).toBe('ok');
});

Then('the room is synced', (w) => {
  expect(RoomMetaAttr.isSynced.from(clientRig(w).room.getSnapshot())).toBe(
    true
  );
});

Then('the room is not synced', (w) => {
  expect(RoomMetaAttr.isSynced.from(clientRig(w).room.getSnapshot())).toBe(
    false
  );
});

Then(
  "{person}'s device has asked to sync from sequence number {int}",
  (w, _person: string, fromSeq: number) => {
    expect(clientRig(w).transport.sent.at(-1)).toEqual({
      v: WIRE_VERSION,
      kind: 'sync',
      fromSeq,
    });
  }
);

Then(
  "{person}'s device has sent {int} command(s)",
  (w, _person: string, count: number) => {
    expect(sentCommands(clientRig(w))).toHaveLength(count);
  }
);

// Alice's moves

When(
  '{person} moves to {int}, {int}',
  (w, _person: string, x: number, y: number) => {
    move(clientRig(w), { x, y });
  }
);

Given(
  '{person} has moved to {int}, {int}',
  (w, _person: string, x: number, y: number) => {
    move(clientRig(w), { x, y });
  }
);

Given(
  '{person} has moved along x to {ints}',
  (w, _person: string, xs: number[]) => {
    for (const at of alongX(xs)) move(clientRig(w), at);
  }
);

When('{person} makes one move more than the outbound queue holds', (w) => {
  const rig = clientRig(w);
  for (let i = 0; i <= MAX_PENDING_OUTBOUND_COMMANDS; i += 1) {
    move(rig, { x: i, y: 0 });
  }
});

// The server's side

When("the server commits alice's move {int} as predicted", (w, n: number) => {
  commitPredicted(clientRig(w), n);
});

Given(
  "the server has committed alice's move {int} as predicted",
  (w, n: number) => {
    commitPredicted(clientRig(w), n);
  }
);

When(
  "the server commits {person}'s move to {int}, {int}",
  (w, person: string, x: number, y: number) => {
    commitOther(clientRig(w), person, { x, y });
  }
);

Given(
  "the server has committed {person}'s move to {int}, {int}",
  (w, person: string, x: number, y: number) => {
    commitOther(clientRig(w), person, { x, y });
  }
);

When(
  "the server commits alice's move {int} landing at {int}, {int}",
  (w, n: number, x: number, y: number) => {
    const rig = clientRig(w);
    rig.transport.deliver(
      committed(
        [movedEntry(nextSeq(rig), 'alice', { x, y })],
        commandId(rig, n)
      )
    );
  }
);

When(
  "the server commits {person}'s move at sequence number {int}",
  (w, person: string, seq: number) => {
    clientRig(w).transport.deliver(
      committed([movedEntry(seq, person, { x: seq, y: 0 })])
    );
  }
);

When(
  "the server refuses alice's move {int} as a conflict {string}",
  (w, n: number, reason: string) => {
    const rig = clientRig(w);
    rig.transport.deliver({
      v: WIRE_VERSION,
      kind: 'rejected',
      commandId: commandId(rig, n),
      error: { type: ROOM_ERROR_TYPE.conflict, reason },
    });
  }
);

When('a roster listing {person} arrives', (w) => {
  clientRig(w).transport.deliver({
    v: WIRE_VERSION,
    kind: 'roster',
    clients: [ACTOR],
  });
});

// What the room shows

Then(
  "{person}'s cursor shows at {int}, {int}",
  (w, person: string, x: number, y: number) => {
    expect(readPositions(clientRig(w).room.getSnapshot())[person]).toEqual({
      x,
      y,
    });
  }
);

Then("{person}'s cursor is not shown", (w, person: string) => {
  expect(
    readPositions(clientRig(w).room.getSnapshot())[person]
  ).toBeUndefined();
});

Then('the room counts {int} move(s)', (w, count: number) => {
  expect(readMoves(clientRig(w).room.getSnapshot())).toBe(count);
});

Then('{int} command(s) was/were replayed', (w, count: number) => {
  expect(clientRig(w).handles() - before(w).handles).toBe(count);
});

Then('the snapshot is the same object as before', (w) => {
  expect(clientRig(w).room.getSnapshot()).toBe(before(w).snapshot);
});

Then('the snapshot is a new object', (w) => {
  expect(clientRig(w).room.getSnapshot()).not.toBe(before(w).snapshot);
});

Then('{int} command(s) is/are pending', (w, count: number) => {
  expect(clientRig(w).room.getPendingQueueIds()).toHaveLength(count);
});

Then('the pending commands are {string}', (w, ids: string) => {
  expect([...clientRig(w).room.getPendingQueueIds()]).toEqual(ids.split(', '));
});

Then('as many commands are pending as the outbound queue holds', (w) => {
  expect(clientRig(w).room.getPendingQueueIds()).toHaveLength(
    MAX_PENDING_OUTBOUND_COMMANDS
  );
});

Then('the last sequence number is {int}', (w, seq: number) => {
  expect(clientRig(w).room.getLastSeq()).toBe(seq);
});

Then("the room's roster lists {person}", (w) => {
  expect(clientRig(w).room.getRoster()).toEqual([ACTOR]);
});

Then(
  "{person}'s device reported a conflict {string}",
  (w, _person: string, reason: string) => {
    expect(clientRig(w).errors).toEqual([
      { type: ROOM_ERROR_TYPE.conflict, reason },
    ]);
  }
);

Then("{person}'s device reported being rate-limited", (w) => {
  expect(clientRig(w).errors.at(-1)).toEqual({
    type: ROOM_ERROR_TYPE.rateLimited,
  });
});

Then(
  'the room shows the last error as a conflict {string}',
  (w, reason: string) => {
    expect(
      RoomMetaAttr.lastError.from(clientRig(w).room.getSnapshot())
    ).toEqual({ type: ROOM_ERROR_TYPE.conflict, reason });
  }
);

// The log

Then(
  'reading the log twice gives the same array of {int} entry/entries',
  (w, count: number) => {
    const log = clientRig(w).room.getLog();
    expect(log).toHaveLength(count);
    expect(clientRig(w).room.getLog()).toBe(log);
  }
);

Given('the log is remembered', (w) => {
  remember(w, 'log', clientRig(w).room.getLog());
});

Then(
  'the log is a new array with sequence numbers {ints}',
  (w, seqs: number[]) => {
    const log = clientRig(w).room.getLog();
    expect(log).not.toBe(recall(w, 'log'));
    expect(log.map((e) => e.seq)).toEqual(seqs);
  }
);

Then(
  'the remembered log still holds {int} entry/entries',
  (w, count: number) => {
    expect(recall<readonly LogEntry[]>(w, 'log')).toHaveLength(count);
  }
);

// The device's storage

Given(
  "the device stored {person}'s move to {int}, {int}",
  (w, person: string, x: number, y: number) => {
    const storage = deviceStorage(w);
    storage.entries = [
      ...storage.entries,
      movedEntry(storage.entries.length + 1, person, { x, y }),
    ];
  }
);

Given(
  'the device queued move {string} to {int}, {int}',
  (w, id: string, x: number, y: number) => {
    const storage = deviceStorage(w);
    storage.queue = [...storage.queue, { id, ts: 1, payload: Move({ x, y }) }];
  }
);

Given(
  "the device stored {person}'s move at sequence number {int} and nothing before it",
  (w, person: string, seq: number) => {
    deviceStorage(w).entries = [movedEntry(seq, person, { x: 1, y: 0 })];
  }
);

When("{person}'s device writes to storage", async (w) => {
  await clientRig(w).room.flushIo();
});

Then('the stored queue holds the pending commands', (w) => {
  const rig = clientRig(w);
  expect(rig.storage.queue.map((q) => q.id)).toEqual([
    ...rig.room.getPendingQueueIds(),
  ]);
});

Then('the stored queue is empty', (w) => {
  expect(clientRig(w).storage.queue).toEqual([]);
});

Then('storage holds sequence numbers {ints}', (w, seqs: number[]) => {
  expect(clientRig(w).storage.entries.map((e) => e.seq)).toEqual(seqs);
});

Then(
  'storage appended {int} entries in all and was reset {int} times',
  (w, appended: number, resets: number) => {
    const { storage } = clientRig(w);
    expect(storage.appendedEntries).toBe(appended);
    expect(storage.resets).toBe(resets);
  }
);

Then('storage was reset {int} time(s)', (w, resets: number) => {
  expect(deviceStorage(w).resets).toBe(resets);
});

Then(
  'storage was reset {int} time(s) and holds no entries',
  (w, resets: number) => {
    expect(deviceStorage(w).resets).toBe(resets);
    expect(deviceStorage(w).entries).toEqual([]);
  }
);
