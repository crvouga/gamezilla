import { Assert } from '@gamezilla/lib/assert';
import { createNamespace, isPlainRecord } from '@gamezilla/lib/message';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import { Database } from 'bun:sqlite';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { Room } from '../room';
import type { Command } from '../room/types';
import { isSystemEvent } from '../events/utils';
import {
  MarkPlaced,
  PlaceMark,
  TicTacToeModule,
} from '../testkit/fixtures/tic-tac-toe.module';
import { TestCrashHandler } from '../testkit/test-crash-handler';
import { ticTacToeBoardCell } from '../testkit/tic-tac-toe-board';
import { testPeerForLabel, ticTacToeThreePeers } from '../testkit/tic-tac-toe-peers';
import { InMemoryBus, InMemoryTransport } from '../transport';
import { recoverRoomFromPersistence } from './persistence';
import { InMemoryRoomPersistence } from './persistence-in-memory';
import { SqliteRoomPersistence } from './persistence-sqlite';
import type { LogEntry } from './log-entry';

const persistenceTestNs = createNamespace('roomPersistenceTest');
function validateTurnChangedPayload(p: unknown): p is { next: string } {
  if (!isPlainRecord(p)) return false;
  const next = p['next'];
  return typeof next === 'string' && next.length > 0;
}
const TurnChanged = persistenceTestNs('TURN_CHANGED', validateTurnChangedPayload);

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

// ─── InMemoryRoomPersistence ────────────────────────────────────

describe('InMemoryRoomPersistence', () => {
  it('append and load in order', async () => {
    const journal = new InMemoryRoomPersistence();
    const cmd: Command = {
      id: 'cmd-1',
      seq: 1,
      peerId: 'p1',
      message: { type: 'MOVE', payload: {} },
    };
    const committedRows: LogEntry[] = [
      { seq: 1, event: { type: 'MOVED', payload: {} } },
    ];

    await journal.append('log-part-1', { kind: 'command', command: cmd });
    await journal.append('log-part-1', {
      kind: 'committed',
      commandId: 'cmd-1',
      entries: committedRows,
    });

    const loaded = await journal.load('log-part-1');
    expect(loaded).toHaveLength(2);
    expect(loaded[0]!.kind).toBe('command');
    expect(loaded[1]!.kind).toBe('committed');
  });

  it('isolates partition keys', async () => {
    const journal = new InMemoryRoomPersistence();
    await journal.append('part-a', {
      kind: 'committed',
      commandId: 'c1',
      entries: [{ seq: 1, event: { type: 'A', payload: {} } }],
    });
    await journal.append('part-b', {
      kind: 'committed',
      commandId: 'c2',
      entries: [{ seq: 1, event: { type: 'B', payload: {} } }],
    });

    expect(await journal.load('part-a')).toHaveLength(1);
    expect(await journal.load('part-b')).toHaveLength(1);
    expect(await journal.load('part-c')).toHaveLength(0);
  });

  it('load returns copies', async () => {
    const journal = new InMemoryRoomPersistence();
    await journal.append('g', {
      kind: 'committed',
      commandId: 'c1',
      entries: [],
    });
    const a = await journal.load('g');
    const b = await journal.load('g');
    expect(a).not.toBe(b);
  });
});

// ─── recoverRoomFromPersistence ─────────────────────────────────

describe('recoverRoomFromPersistence', () => {
  it('replays committed events and identifies unresolved commands', async () => {
    const journal = new InMemoryRoomPersistence();

    const resolvedCmd: Command = {
      id: 'cmd-resolved',
      seq: 1,
      peerId: 'p1',
      message: { type: 'MOVE', payload: {} },
    };
    const unresolvedCmd: Command = {
      id: 'cmd-unresolved',
      seq: 2,
      peerId: 'p1',
      message: { type: 'MOVE', payload: {} },
    };

    await journal.append('log-part-1', { kind: 'command', command: resolvedCmd });
    await journal.append('log-part-1', {
      kind: 'committed',
      commandId: 'cmd-resolved',
      entries: [
        { seq: 1, event: { type: 'PIECE_MOVED', payload: { cell: 0 } } },
      ],
    });
    await journal.append('log-part-1', { kind: 'command', command: unresolvedCmd });

    let rehydratedEntries: LogEntry[] = [];
    const unresolved: Command[] = [];

    const mockRoom = {
      rehydrate(entries: LogEntry[]) {
        rehydratedEntries = entries;
      },
      dispatch() {},
      subscribe() {
        return () => {};
      },
      getState() {
        return {};
      },
      getCommittedState() {
        return {};
      },
      getCommittedLogEntries() {
        return [];
      },
      requestSync() {},
      isSynced() {
        return true;
      },
      destroy() {},
    };

    await recoverRoomFromPersistence(journal, 'log-part-1', mockRoom, (cmd) =>
      unresolved.push(cmd)
    );

    expect(rehydratedEntries).toHaveLength(1);
    expect(rehydratedEntries[0]!.event.type).toBe('PIECE_MOVED');
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]!.id).toBe('cmd-unresolved');
  });

  it('handles rejected commands as resolved', async () => {
    const journal = new InMemoryRoomPersistence();

    const cmd: Command = {
      id: 'cmd-rej',
      seq: 1,
      peerId: 'p1',
      message: { type: 'BAD', payload: {} },
    };
    await journal.append('g', { kind: 'command', command: cmd });
    await journal.append('g', { kind: 'rejected', commandId: 'cmd-rej' });

    const unresolved: Command[] = [];
    const mockRoom = {
      rehydrate() {},
      dispatch() {},
      subscribe() {
        return () => {};
      },
      getState() {
        return {};
      },
      getCommittedState() {
        return {};
      },
      getCommittedLogEntries() {
        return [];
      },
      requestSync() {},
      isSynced() {
        return true;
      },
      destroy() {},
    };

    await recoverRoomFromPersistence(journal, 'g', mockRoom, (cmd) =>
      unresolved.push(cmd)
    );

    expect(unresolved).toHaveLength(0);
  });

  it('works with empty log', async () => {
    const journal = new InMemoryRoomPersistence();
    let rehydrated = false;
    const mockRoom = {
      rehydrate() {
        rehydrated = true;
      },
      dispatch() {},
      subscribe() {
        return () => {};
      },
      getState() {
        return {};
      },
      getCommittedState() {
        return {};
      },
      getCommittedLogEntries() {
        return [];
      },
      requestSync() {},
      isSynced() {
        return true;
      },
      destroy() {},
    };

    await recoverRoomFromPersistence(journal, 'scope-missing', mockRoom);
    expect(rehydrated).toBe(true);
  });
});

// ─── SqliteRoomPersistence ──────────────────────────────────────

describe('SqliteRoomPersistence', () => {
  let sqlClient: SqlClientImplBunSqlite;
  let persistence: SqliteRoomPersistence;

  beforeEach(async () => {
    sqlClient = new SqlClientImplBunSqlite(new Database(':memory:'));
    await sqlClient.connect();
    persistence = new SqliteRoomPersistence(sqlClient);
    await persistence.migrate();
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  it('append and load preserves order', async () => {
    const cmd: Command = {
      id: 'cmd-1',
      seq: 1,
      peerId: 'p1',
      message: { type: 'MOVE', payload: { cell: 4 } },
    };
    await persistence.append('log-part-1', { kind: 'command', command: cmd });
    await persistence.append('log-part-1', {
      kind: 'committed',
      commandId: 'cmd-1',
      entries: [
        { seq: 1, event: { type: 'PIECE_MOVED', payload: { cell: 4 } } },
      ],
    });
    await persistence.append('log-part-1', {
      kind: 'rejected',
      commandId: 'cmd-2',
    });

    const entries = await persistence.load('log-part-1');
    expect(entries).toHaveLength(3);
    expect(entries[0]!.kind).toBe('command');
    expect(entries[1]!.kind).toBe('committed');
    expect(entries[2]!.kind).toBe('rejected');
  });

  it('round-trips command data through JSON', async () => {
    const cmd: Command = {
      id: 'cmd-rt',
      seq: 7,
      peerId: 'player-x',
      message: PlaceMark({ cell: 0, player: 'X' }),
    };
    await persistence.append('g', { kind: 'command', command: cmd });

    const entries = await persistence.load('g');
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.kind).toBe('command');
    if (entry.kind === 'command') {
      expect(entry.command.id).toBe('cmd-rt');
      expect(entry.command.seq).toBe(7);
      expect(entry.command.peerId).toBe('player-x');
      expect(PlaceMark.is(entry.command.message)).toBe(true);
    }
  });

  it('round-trips committed events through JSON', async () => {
    const logEntries: LogEntry[] = [
      { seq: 1, event: MarkPlaced({ cell: 0, player: 'X', seq: 1 }) },
      { seq: 2, event: TurnChanged({ next: 'O' }) },
    ];
    await persistence.append('g', {
      kind: 'committed',
      commandId: 'c1',
      entries: logEntries,
    });

    const rows = await persistence.load('g');
    expect(rows).toHaveLength(1);
    const entry = rows[0]!;
    if (entry.kind === 'committed') {
      expect(entry.entries).toHaveLength(2);
      expect(MarkPlaced.is(entry.entries[0]!.event)).toBe(true);
      expect(TurnChanged.is(entry.entries[1]!.event)).toBe(true);
    }
  });

  it('isolates partition keys', async () => {
    await persistence.append('a', {
      kind: 'committed',
      commandId: 'c1',
      entries: [],
    });
    await persistence.append('b', {
      kind: 'committed',
      commandId: 'c2',
      entries: [],
    });

    expect(await persistence.load('a')).toHaveLength(1);
    expect(await persistence.load('b')).toHaveLength(1);
    expect(await persistence.load('c')).toHaveLength(0);
  });

  it('migrate is idempotent', async () => {
    await persistence.migrate();
    await persistence.migrate();

    await persistence.append('g', {
      kind: 'committed',
      commandId: 'c1',
      entries: [],
    });
    expect(await persistence.load('g')).toHaveLength(1);
  });

  it('seq increments correctly across appends', async () => {
    for (let i = 0; i < 5; i++) {
      await persistence.append('g', {
        kind: 'committed',
        commandId: `c${i}`,
        entries: [{ seq: i + 1, event: { type: `E${i}`, payload: {} } }],
      });
    }
    const entries = await persistence.load('g');
    expect(entries).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      const entry = entries[i]!;
      if (entry.kind === 'committed') {
        expect(entry.commandId).toBe(`c${i}`);
      }
    }
  });
});

// ─── Integration: Room + persistence journal ────────────────────

describe('Room + persistence journal integration', () => {
  const INT_TOPIC = 'persistence-int';
  const FIX = ticTacToeThreePeers();
  const PEER = {
    authority: FIX.peers.authority.peerId,
    playerX: FIX.peers.playerX.peerId,
    playerO: FIX.peers.playerO.peerId,
  } as const;

  function setup() {
    const bus = new InMemoryBus();
    const t_x = new InMemoryTransport(bus, PEER.playerX);
    const t_o = new InMemoryTransport(bus, PEER.playerO);
    const t_auth = new InMemoryTransport(bus, PEER.authority);
    const peers = FIX.initialMembership;
    const pubMap = FIX.initialMemberPublicKeys;
    const seeds = FIX.peerSecretSeeds;

    const journal = new InMemoryRoomPersistence();
    const partitionKey = INT_TOPIC;
    const committed: Array<{ commandId: string; entries: LogEntry[] }> = [];
    const rejected: string[] = [];

    const store_x = Room.open({
      module: TicTacToeModule,
      topic: INT_TOPIC,
      roomSecret: FIX.roomSecret,
      secretSeed: seeds[PEER.playerX]!,
      transport: t_x,
      persistence: new InMemoryRoomPersistence(),
      role: {
        type: 'host',
        initialMembership: peers,
        initialMemberPublicKeys: pubMap,
      },
    });
    const store_o = Room.open({
      module: TicTacToeModule,
      topic: INT_TOPIC,
      roomSecret: FIX.roomSecret,
      secretSeed: seeds[PEER.playerO]!,
      transport: t_o,
      persistence: new InMemoryRoomPersistence(),
      role: {
        type: 'host',
        initialMembership: peers,
        initialMemberPublicKeys: pubMap,
      },
      onReject(commandId) {
        rejected.push(commandId);
      },
    });
    const store_auth = Room.open({
      module: TicTacToeModule,
      topic: INT_TOPIC,
      roomSecret: FIX.roomSecret,
      secretSeed: seeds[PEER.authority]!,
      transport: t_auth,
      persistence: journal,
      role: {
        type: 'host',
        initialMembership: peers,
        initialMemberPublicKeys: pubMap,
      },
      onCommit(commandId, entries) {
        committed.push({ commandId, entries });
      },
    });

    void journal.append(partitionKey, {
      kind: 'committed',
      commandId: '__seed__',
      entries: store_auth.getCommittedLogEntries(),
    });

    function destroy() {
      store_x.destroy();
      store_o.destroy();
      store_auth.destroy();
      t_x.destroy();
      t_o.destroy();
      t_auth.destroy();
      bus.destroy();
    }

    return {
      store_x,
      store_o,
      store_auth,
      journal,
      partitionKey,
      committed,
      rejected,
      destroy,
      t_x,
      t_o,
      t_auth,
      bus,
    };
  }

  it('onCommit callback captures all committed events', () => {
    const { store_x, store_o, store_auth, committed, destroy } = setup();

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }));
    store_o.dispatch(PlaceMark({ cell: 3, player: 'O' }));
    store_x.dispatch(PlaceMark({ cell: 1, player: 'X' }));

    expect(committed).toHaveLength(3);

    const authDomain = store_auth
      .getCommittedLogEntries()
      .filter((e) => !isSystemEvent(e.event));
    const loggedDomain = committed
      .flatMap((c) => c.entries)
      .filter((e) => !isSystemEvent(e.event));
    expect(loggedDomain).toHaveLength(authDomain.length);

    destroy();
  });

  it('onReject callback fires for rejected commands', () => {
    const { store_x, store_o, rejected, destroy, t_o } = setup();

    t_o.disconnect();

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }));

    store_o.dispatch(PlaceMark({ cell: 0, player: 'X' }));

    t_o.reconnect();

    expect(rejected.length).toBeGreaterThanOrEqual(1);

    destroy();
  });

  it('recovery from persistence journal rebuilds state', async () => {
    const { store_x, store_o, store_auth, journal, destroy } = setup();

    store_x.dispatch(PlaceMark({ cell: 4, player: 'X' }));
    store_o.dispatch(PlaceMark({ cell: 0, player: 'O' }));

    const originalState = store_auth.getCommittedState();
    expect(ticTacToeBoardCell(originalState, 4)).toBe('X');
    expect(ticTacToeBoardCell(originalState, 0)).toBe('O');

    destroy();

    const bus2 = new InMemoryBus();
    const t_recovery = new InMemoryTransport(bus2, PEER.authority);
    const dummyId = testPeerForLabel('persistence-dummy').peerId;
    const t_dummy = new InMemoryTransport(bus2, dummyId);
    const recoveredStore = await Room.create({
      module: TicTacToeModule,
      topic: INT_TOPIC,
      roomSecret: FIX.roomSecret,
      secretSeed: FIX.peerSecretSeeds[PEER.authority]!,
      transport: t_recovery,
      persistence: journal,
      role: {
        type: 'join',
        roomSnapshot: {
          initialMembership: FIX.initialMembership,
          initialMemberPublicKeys: FIX.initialMemberPublicKeys,
        },
      },
    });

    const recoveredState = recoveredStore.getCommittedState();
    expect(ticTacToeBoardCell(recoveredState, 4)).toBe('X');
    expect(ticTacToeBoardCell(recoveredState, 0)).toBe('O');
    expect(recoveredState['currentTurn']).toBe('X');

    recoveredStore.destroy();
    t_recovery.destroy();
    t_dummy.destroy();
    bus2.destroy();
  });

  it('dispatch appends command intent to persistence (topic partition)', async () => {
    const bus = new InMemoryBus();
    const transport = new InMemoryTransport(bus, PEER.playerX);
    const persistence = new InMemoryRoomPersistence();
    const store = Room.open({
      module: TicTacToeModule,
      topic: INT_TOPIC,
      roomSecret: FIX.roomSecret,
      secretSeed: FIX.peerSecretSeeds[PEER.playerX]!,
      transport,
      persistence,
      role: {
        type: 'host',
        initialMembership: FIX.initialMembership,
        initialMemberPublicKeys: FIX.initialMemberPublicKeys,
      },
    });

    store.dispatch(PlaceMark({ cell: 0, player: 'X' }));

    const rows = await persistence.load(INT_TOPIC);
    const intents = rows.filter((r) => r.kind === 'command');
    expect(intents.length).toBeGreaterThanOrEqual(1);
    const lastIntent = intents[intents.length - 1]!;
    expect(lastIntent.kind).toBe('command');
    if (lastIntent.kind === 'command') {
      expect(PlaceMark.is(lastIntent.command.message)).toBe(true);
    }

    store.destroy();
    transport.destroy();
    bus.destroy();
  });
});
