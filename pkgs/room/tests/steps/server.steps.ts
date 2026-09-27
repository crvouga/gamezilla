/** Steps for a `RoomServer` and the connections talking to it. */

import { expect } from 'bun:test';
import {
  type LogEntry,
  MAX_WELCOME_ENTRIES_PER_FRAME,
  ROOM_ERROR_TYPE,
  WIRE_VERSION,
} from '@pkgs/room';
import { MOVES_KEY, Move } from '../helpers/cursor-module';
import {
  connection,
  connectPerson,
  framesOfKind,
  moveCommand,
  type ServerRig,
  startServer,
} from './server-rig';
import { Given, recall, remember, serverRig, Then, When } from './world';

async function send(
  rig: ServerRig,
  person: string,
  frame: unknown
): Promise<void> {
  await rig.server.handleClientMessage(person, person, frame);
}

function committed(rig: ServerRig, person: string) {
  return framesOfKind(connection(rig, person).frames, 'committed') as {
    readonly entries: readonly LogEntry[];
  }[];
}

Given('an empty cursor room server', async (w) => {
  w.server = await startServer();
});

Given(
  'a cursor room server with {people} connected',
  async (w, people: string[]) => {
    const rig = await startServer();
    w.server = rig;
    for (const person of people) connectPerson(rig, person);
  }
);

When('{person} connects', (w, person: string) => {
  connectPerson(serverRig(w), person);
});

When("{person}'s connection closes", (w, person: string) => {
  serverRig(w).server.unregisterConnection(person);
});

When(
  '{person} sends move command {string}',
  async (w, person: string, id: string) => {
    await send(serverRig(w), person, moveCommand(id));
  }
);

Given(
  '{person} has sent move command {string}',
  async (w, person: string, id: string) => {
    await send(serverRig(w), person, moveCommand(id));
  }
);

Given(
  '{person} has committed {int} more moves than one welcome holds',
  async (w, person: string, extra: number) => {
    for (let i = 0; i < MAX_WELCOME_ENTRIES_PER_FRAME + extra; i += 1) {
      await send(serverRig(w), person, moveCommand(`c${String(i)}`));
    }
  }
);

When(
  '{person} sends command {string} whose payload is not a message',
  async (w, person: string, id: string) => {
    await send(serverRig(w), person, {
      ...moveCommand(id),
      payload: 'garbage',
    });
  }
);

When(
  '{person} sends command {string} of unknown type {string}',
  async (w, person: string, id: string, type: string) => {
    await send(serverRig(w), person, {
      ...moveCommand(id),
      payload: { type, payload: {} },
    });
  }
);

When('{person} pings', async (w, person: string) => {
  await send(serverRig(w), person, { v: WIRE_VERSION, kind: 'ping' });
});

When(
  '{person} asks to sync from sequence number {int}',
  async (w, person: string, fromSeq: number) => {
    const rig = serverRig(w);
    remember(w, `sync-from:${person}`, connection(rig, person).frames.length);
    await send(rig, person, { v: WIRE_VERSION, kind: 'sync', fromSeq });
  }
);

When('the scheduler injects move command {string}', async (w, id: string) => {
  await serverRig(w).server.injectCommand({
    id,
    payload: Move({ x: 3, y: 3 }),
    identity: 'room:scheduler',
  });
});

async function restart(w: Parameters<typeof serverRig>[0]): Promise<void> {
  w.server = await startServer(serverRig(w).storage);
}

When('the server restarts from the same storage', restart);
Given('the server has restarted from the same storage', restart);

Then(
  '{people} each received {int} committed frame(s)',
  (w, people: string[], count: number) => {
    for (const person of people) {
      expect(committed(serverRig(w), person)).toHaveLength(count);
    }
  }
);

Then(
  '{person} received {int} committed frame(s)',
  (w, person: string, count: number) => {
    expect(committed(serverRig(w), person)).toHaveLength(count);
  }
);

Then(
  '{people} received the same first committed frame',
  (w, people: string[]) => {
    const [first, ...rest] = people.map(
      (person) => committed(serverRig(w), person)[0]
    );
    expect(first).toBeDefined();
    for (const frame of rest) expect(frame).toBe(first);
  }
);

Then(
  "{person}'s last committed frame carries sequence number {int}",
  (w, person: string, seq: number) => {
    const last = committed(serverRig(w), person).at(-1);
    expect(last?.entries.map((e) => e.seq)).toEqual([seq]);
  }
);

Then('the log holds sequence numbers {ints}', (w, seqs: number[]) => {
  expect(serverRig(w).storage.entries.map((e) => e.seq)).toEqual(seqs);
});

Then('the log holds {int} entry/entries', (w, count: number) => {
  expect(serverRig(w).storage.entries).toHaveLength(count);
});

Then('the committed state counts {int} move(s)', (w, count: number) => {
  expect(serverRig(w).server.getCommittedState()[MOVES_KEY]).toBe(count);
});

Then('the server has not read its log tip since it started', (w) => {
  const rig = serverRig(w);
  expect(rig.storage.lastSeqReads).toBe(rig.tipReadsAtStart);
});

Then('entry {int} was made by the scheduler', (w, seq: number) => {
  const entry = serverRig(w).storage.entries.find((e) => e.seq === seq);
  expect(entry?.actor).toEqual({ id: 'room:scheduler', clientId: 'scheduler' });
});

Then(
  '{person} received {int} invalid-command refusal(s)',
  (w, person: string, count: number) => {
    const refusals = framesOfKind(
      connection(serverRig(w), person).frames,
      'rejected'
    ) as { readonly error: { readonly type: string } }[];
    expect(refusals.map((f) => f.error.type)).toEqual(
      Array.from({ length: count }, () => ROOM_ERROR_TYPE.invalidCommand)
    );
  }
);

Then('the server remembers command {string} as refused', (w, id: string) => {
  expect(serverRig(w).storage.dedup.get(id)?.kind).toBe('rejected');
});

Then("{person}'s last frame is a pong", (w, person: string) => {
  expect(connection(serverRig(w), person).frames.at(-1)).toEqual({
    v: WIRE_VERSION,
    kind: 'pong',
  });
});

function framesSinceSync(w: Parameters<typeof serverRig>[0], person: string) {
  const from = recall<number>(w, `sync-from:${person}`);
  return connection(serverRig(w), person).frames.slice(from);
}

Then(
  '{person} receives a full welcome saying the log runs {int} entries further',
  (w, person: string, further: number) => {
    const welcome = framesSinceSync(w, person)[0] as {
      readonly kind: string;
      readonly lastSeq: number;
      readonly entries: readonly LogEntry[];
    };
    expect(welcome.kind).toBe('welcome');
    expect(welcome.entries).toHaveLength(MAX_WELCOME_ENTRIES_PER_FRAME);
    expect(welcome.lastSeq).toBe(MAX_WELCOME_ENTRIES_PER_FRAME + further);
  }
);

Then('{person} then receives the roster', (w, person: string) => {
  const next = framesSinceSync(w, person)[1] as { readonly kind: string };
  expect(next.kind).toBe('roster');
});

Then('the roster lists {person}', (w, person: string) => {
  expect(serverRig(w).server.getRoster()).toEqual([
    { id: person, clientId: person },
  ]);
});

Then('the roster is empty', (w) => {
  expect(serverRig(w).server.getRoster()).toEqual([]);
});

Then(
  '{person} received {int} roster frame(s)',
  (w, person: string, count: number) => {
    expect(
      framesOfKind(connection(serverRig(w), person).frames, 'roster')
    ).toHaveLength(count);
  }
);
