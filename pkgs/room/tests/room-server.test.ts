import { describe, expect, test } from 'bun:test';
import type { Message } from '@pkgs/message';
import {
  type LogEntry,
  MAX_WELCOME_ENTRIES_PER_FRAME,
  ROOM_ERROR_TYPE,
  ROOM_WIRE_KIND,
  type RoomState,
  WIRE_VERSION,
} from '@pkgs/room';
import {
  type CommandDedupOutcome,
  RoomServer,
  type RoomStorage,
} from '@pkgs/room/server';
import { CursorModule, MOVES_KEY, Move } from './helpers/cursor-module';
import { testPorts } from './helpers/ports';

/** In-memory RoomStorage with op counters. */
class CountingRoomStorage implements RoomStorage {
  entries: LogEntry[] = [];
  dedup = new Map<string, CommandDedupOutcome>();
  lastSeqReads = 0;

  async loadEventsAfter(_t: string, afterSeq: number): Promise<LogEntry[]> {
    return this.entries.filter((e) => e.seq > afterSeq);
  }
  async getLastSeq(): Promise<number> {
    this.lastSeqReads += 1;
    return this.entries.at(-1)?.seq ?? 0;
  }
  async appendCommittedEntries(_t: string, batch: LogEntry[]): Promise<void> {
    let expect = (this.entries.at(-1)?.seq ?? 0) + 1;
    for (const e of batch) {
      if (e.seq !== expect++) throw new Error(`seq gap at ${String(e.seq)}`);
      this.entries.push(e);
    }
  }
  async getDedupOutcome(
    _t: string,
    id: string
  ): Promise<CommandDedupOutcome | null> {
    return this.dedup.get(id) ?? null;
  }
  async putDedupOutcome(
    _t: string,
    id: string,
    o: CommandDedupOutcome
  ): Promise<void> {
    this.dedup.set(id, o);
  }
}

type Conn = { id: string; frames: unknown[] };

async function boot(storage = new CountingRoomStorage()) {
  const ports = testPorts();
  const server = new RoomServer<RoomState, Message, Message, string>({
    topic: 'room:1',
    module: CursorModule,
    storage,
    clock: ports.clock,
  });
  await server.hydrateFromStorage();
  const connect = (id: string, actor: string): Conn => {
    const conn: Conn = { id, frames: [] };
    server.registerConnection(id, (f) => conn.frames.push(f), {
      id: actor,
      clientId: id,
    });
    return conn;
  };
  const command = (id: string, x: number) => ({
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id,
    ts: 1,
    payload: Move({ x, y: 0 }),
  });
  return { server, storage, ports, connect, command };
}

describe('RoomServer', () => {
  test('commit fans out one shared frame object and caches the tip', async () => {
    const s = await boot();
    const a = s.connect('a', 'alice');
    const b = s.connect('b', 'bob');
    const readsAfterHydrate = s.storage.lastSeqReads;
    await s.server.handleClientMessage('a', 'alice', s.command('c1', 1));
    await s.server.handleClientMessage('b', 'bob', s.command('c2', 2));
    const aCommitted = a.frames.filter(
      (f) => (f as { kind: string }).kind === 'committed'
    );
    const bCommitted = b.frames.filter(
      (f) => (f as { kind: string }).kind === 'committed'
    );
    expect(aCommitted).toHaveLength(2);
    expect(aCommitted[0]).toBe(bCommitted[0]);
    expect(s.storage.entries.map((e) => e.seq)).toEqual([1, 2]);
    expect(s.storage.lastSeqReads).toBe(readsAfterHydrate);
    expect(s.server.getCommittedState()[MOVES_KEY]).toBe(2);
  });

  test('duplicate commandId replays the stored outcome without re-applying', async () => {
    const s = await boot();
    const a = s.connect('a', 'alice');
    await s.server.handleClientMessage('a', 'alice', s.command('dup', 1));
    await s.server.handleClientMessage('a', 'alice', s.command('dup', 1));
    expect(s.storage.entries).toHaveLength(1);
    const committed = a.frames.filter(
      (f) => (f as { kind: string }).kind === 'committed'
    );
    expect(committed).toHaveLength(2);
    expect((committed[1] as { entries: LogEntry[] }).entries[0]!.seq).toBe(1);
  });

  test('non-envelope payload and unknown commands are rejected and remembered', async () => {
    const s = await boot();
    const a = s.connect('a', 'alice');
    await s.server.handleClientMessage('a', 'alice', {
      ...s.command('bad', 1),
      payload: 'garbage',
    });
    await s.server.handleClientMessage('a', 'alice', {
      ...s.command('unknown', 1),
      payload: { type: 'cursor-cmd/teleport', payload: {} },
    });
    const rejected = a.frames.filter(
      (f) => (f as { kind: string }).kind === 'rejected'
    );
    expect(
      rejected.map((f) => (f as { error: { type: string } }).error.type)
    ).toEqual([ROOM_ERROR_TYPE.invalidCommand, ROOM_ERROR_TYPE.invalidCommand]);
    expect(s.storage.dedup.get('bad')?.kind).toBe('rejected');
    expect(s.storage.entries).toHaveLength(0);
  });

  test('ping answers immediately; sync sends a capped welcome plus roster', async () => {
    const s = await boot();
    const a = s.connect('a', 'alice');
    await s.server.handleClientMessage('a', 'alice', {
      v: WIRE_VERSION,
      kind: 'ping',
    });
    expect(a.frames.at(-1)).toEqual({ v: WIRE_VERSION, kind: 'pong' });
    for (let i = 0; i < MAX_WELCOME_ENTRIES_PER_FRAME + 5; i++) {
      await s.server.handleClientMessage(
        'a',
        'alice',
        s.command(`c${String(i)}`, i)
      );
    }
    a.frames.length = 0;
    await s.server.handleClientMessage('a', 'alice', {
      v: WIRE_VERSION,
      kind: 'sync',
      fromSeq: 0,
    });
    const w = a.frames[0] as {
      kind: string;
      lastSeq: number;
      entries: LogEntry[];
    };
    expect(w.kind).toBe('welcome');
    expect(w.entries).toHaveLength(MAX_WELCOME_ENTRIES_PER_FRAME);
    expect(w.lastSeq).toBe(MAX_WELCOME_ENTRIES_PER_FRAME + 5);
    expect((a.frames[1] as { kind: string }).kind).toBe('roster');
  });

  test('injectCommand dedups, uses the scheduler actor and updates state', async () => {
    const s = await boot();
    const a = s.connect('a', 'alice');
    await s.server.injectCommand({
      id: 'i1',
      payload: Move({ x: 3, y: 3 }),
      identity: 'room:scheduler',
    });
    await s.server.injectCommand({
      id: 'i1',
      payload: Move({ x: 3, y: 3 }),
      identity: 'room:scheduler',
    });
    expect(s.storage.entries).toHaveLength(1);
    expect(s.storage.entries[0]!.actor).toEqual({
      id: 'room:scheduler',
      clientId: 'scheduler',
    });
    expect(
      a.frames.some((f) => (f as { kind: string }).kind === 'committed')
    ).toBe(true);
  });

  test('hydrate restores state and tip from storage; roster tracks connections', async () => {
    const storage = new CountingRoomStorage();
    const first = await boot(storage);
    first.connect('a', 'alice');
    await first.server.handleClientMessage(
      'a',
      'alice',
      first.command('c1', 1)
    );
    const second = await boot(storage);
    expect(second.server.getCommittedState()[MOVES_KEY]).toBe(1);
    const b = second.connect('b', 'bob');
    await second.server.handleClientMessage(
      'b',
      'bob',
      second.command('c2', 2)
    );
    expect(storage.entries.map((e) => e.seq)).toEqual([1, 2]);
    expect(second.server.getRoster()).toEqual([{ id: 'bob', clientId: 'b' }]);
    second.server.unregisterConnection('b');
    expect(second.server.getRoster()).toEqual([]);
    expect(
      b.frames.filter((f) => (f as { kind: string }).kind === 'roster')
    ).toHaveLength(1);
  });
});
