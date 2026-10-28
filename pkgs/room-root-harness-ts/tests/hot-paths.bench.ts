// @io-wall-ok — benchmark script (not a test): wall timers are the measurement.
/**
 * Hot-path microbenchmarks for `@pkgs/room`, old engine vs current engine in
 * one process (same JIT). The previous implementation is imported from an
 * untracked snapshot; pass its path via `ROOM_OLD_SRC` (defaults to
 * `<repo>/.bench-old-room/src`). When the snapshot is absent, only the
 * current engine is measured.
 *
 * Run: `bun run --filter @pkgs/room-root-harness-ts bench`
 */
import { fileURLToPath } from 'node:url';
import type { Message } from '@pkgs/message-shared-ts/message';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import {
  AddOne,
  gameRoomModule,
  TallyChanged,
} from '@pkgs/room-root-harness-ts/game-room';
import { RoomServer } from '@pkgs/room-root-server-ts/room-server';
import type { ClientRoomStorage } from '@pkgs/room-root-shared-ts/core-storage';
import {
  canonicalRoomJson,
  hashRoomState,
} from '@pkgs/room-root-shared-ts/hash-room-state';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import { WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { oldMemoryClientStorage } from './bench-old-client-storage';
import { FakeTransport } from './fake-transport';
import { MemoryRoomStorage } from './memory-room-storage';
import { CountingClientStorage } from './memory-storage';
import { testPorts } from './ports';

type CoreModule = {
  readonly RoomClient: typeof RoomClient;
  readonly hashRoomState: typeof hashRoomState;
  readonly canonicalRoomJson: typeof canonicalRoomJson;
};
type ServerModule = { readonly RoomServer: typeof RoomServer };

type Engine = {
  readonly name: string;
  readonly RoomClient: typeof RoomClient;
  readonly RoomServer: typeof RoomServer;
  readonly hashRoomState: typeof hashRoomState;
  readonly canonicalRoomJson: typeof canonicalRoomJson;
  readonly clientStorage: () => unknown;
};

async function loadEngines(): Promise<Engine[]> {
  const engines: Engine[] = [
    {
      name: 'current',
      RoomClient,
      RoomServer,
      hashRoomState,
      canonicalRoomJson,
      clientStorage: () => new CountingClientStorage(),
    },
  ];
  const oldRoot =
    process.env['ROOM_OLD_SRC'] ??
    fileURLToPath(new URL('../../../../.bench-old-room/src', import.meta.url));
  try {
    const oldIndex = (await import(`${oldRoot}/index.ts`)) as CoreModule;
    const oldServer = (await import(`${oldRoot}/server.ts`)) as ServerModule;
    engines.unshift({
      name: 'old',
      RoomClient: oldIndex.RoomClient,
      RoomServer: oldServer.RoomServer,
      hashRoomState: oldIndex.hashRoomState,
      canonicalRoomJson: oldIndex.canonicalRoomJson,
      clientStorage: () => oldMemoryClientStorage(),
    });
  } catch {
    process.stdout.write(`(old engine snapshot not found at ${oldRoot})\n`);
  }
  return engines;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Result = { usPerOp: number };

async function measure(
  fn: () => Promise<void> | void,
  iters: number,
  warmup: number
): Promise<Result> {
  for (let i = 0; i < warmup; i++) await fn();
  Bun.gc(true);
  const start = Bun.nanoseconds();
  for (let i = 0; i < iters; i++) await fn();
  const ns = Bun.nanoseconds() - start;
  return { usPerOp: ns / iters / 1000 };
}

function fmt(n: number): string {
  return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

const rows: { scenario: string; byEngine: Map<string, Result> }[] = [];

async function scenario(
  name: string,
  engines: Engine[],
  build: (e: Engine) => Promise<{
    run: () => Promise<void> | void;
    iters: number;
    warmup?: number;
  }>
): Promise<void> {
  const byEngine = new Map<string, Result>();
  for (const e of engines) {
    const { run, iters, warmup } = await build(e);
    byEngine.set(
      e.name,
      await measure(run, iters, warmup ?? Math.ceil(iters / 5))
    );
  }
  rows.push({ scenario: name, byEngine });
}

function print(engines: Engine[]): void {
  const names = engines.map((e) => e.name);
  const w = Math.max(28, ...rows.map((r) => r.scenario.length));
  const header = `${'scenario'.padEnd(w)}${names.map((n) => `${n} µs/op`.padStart(16)).join('')}${names.length > 1 ? 'speedup'.padStart(10) : ''}`;
  process.stdout.write(`\n${header}\n${'-'.repeat(header.length)}\n`);
  for (const r of rows) {
    const cells = names.map((n) =>
      fmt(r.byEngine.get(n)!.usPerOp).padStart(16)
    );
    let speed = '';
    if (names.length > 1) {
      const old = r.byEngine.get(names[0]!)!.usPerOp;
      const cur = r.byEngine.get(names[names.length - 1]!)!.usPerOp;
      speed = `${(old / cur).toFixed(1)}x`.padStart(10);
    }
    process.stdout.write(`${r.scenario.padEnd(w)}${cells.join('')}${speed}\n`);
  }
  process.stdout.write('\n');
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR = { id: 'alice', clientId: 'tab' };
type AnyClient = RoomClient<RoomState, Message, Message, string>;
type AnyServer = RoomServer<RoomState, Message, Message, string>;

async function openClient(
  e: Engine,
  opts: { connected: boolean; module?: typeof gameRoomModule }
): Promise<{ room: AnyClient; transport: FakeTransport }> {
  const ports = testPorts();
  const transport = new FakeTransport();
  const room = await e.RoomClient.open<RoomState, Message, Message, string>({
    topic: 'bench',
    module: opts.module ?? gameRoomModule,
    storage: e.clientStorage() as ClientRoomStorage,
    transport,
    identity: 'alice',
    clock: ports.clock,
    timers: ports.timers,
    createId: ports.createId,
  });
  if (opts.connected) {
    transport.deliver({
      v: WIRE_VERSION,
      kind: 'welcome',
      fromSeq: 0,
      lastSeq: 0,
      entries: [],
    });
  }
  return { room, transport };
}

function tallyEntry(seq: number, person: string, by: number) {
  const actor = { id: person, clientId: person };
  return { seq, event: TallyChanged({ by }), actor, ts: seq };
}

/** Wire a client transport straight into a RoomServer (no network). */
async function loopback(e: Engine, connections: number) {
  const ports = testPorts();
  const storage = new MemoryRoomStorage();
  const server: AnyServer = new e.RoomServer({
    topic: 'bench',
    module: gameRoomModule,
    storage,
    clock: ports.clock,
  });
  await server.hydrateFromStorage();
  const transport = new FakeTransport();
  let pending: Promise<void> = Promise.resolve();
  transport.onSend = (payload) => {
    pending = server.handleClientMessage('c0', 'alice', payload);
  };
  server.registerConnection('c0', (f) => transport.deliver(f), ACTOR);
  const sinks: string[] = [];
  for (let i = 1; i < connections; i++) {
    server.registerConnection(
      `c${String(i)}`,
      (f) => sinks.push(JSON.stringify(f)),
      {
        id: `peer${String(i)}`,
        clientId: `c${String(i)}`,
      }
    );
  }
  const room = await e.RoomClient.open<RoomState, Message, Message, string>({
    topic: 'bench',
    module: gameRoomModule,
    storage: e.clientStorage() as ClientRoomStorage,
    transport,
    identity: 'alice',
    clock: ports.clock,
    timers: ports.timers,
    createId: ports.createId,
  });
  await pending;
  return { room, server, transport, flush: () => pending, sinks };
}

function bigState(): RoomState {
  const positions: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < 40; i++)
    positions[`player-${String(i)}`] = { x: i * 3, y: i * 7 };
  const state: Record<string, unknown> = {
    'cursor/positions': positions,
    'cursor/moves': 1234,
  };
  for (let i = 0; i < 20; i++)
    state[`game/slot-${String(i)}`] = {
      seat: i,
      ready: i % 2 === 0,
      tags: ['a', 'b'],
    };
  return state as RoomState;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const engines = await loadEngines();

await scenario(
  'dispatch offline, queue depth 1..200 (per dispatch)',
  engines,
  async (e) => {
    let opened = await openClient(e, { connected: false });
    let n = 0;
    return {
      iters: 4_000,
      warmup: 400,
      run: async () => {
        if (n === 200) {
          opened.room.destroy();
          opened = await openClient(e, { connected: false });
          n = 0;
        }
        opened.room.dispatch(AddOne({}));
        n += 1;
      },
    };
  }
);

await scenario(
  'dispatch → server commit → echo (1 peer)',
  engines,
  async (e) => {
    const lb = await loopback(e, 1);
    return {
      iters: 4_000,
      run: async () => {
        lb.room.dispatch(AddOne({}));
        await lb.flush();
      },
    };
  }
);

await scenario(
  'dispatch → server commit → echo (8 peers, JSON sinks)',
  engines,
  async (e) => {
    const lb = await loopback(e, 8);
    return {
      iters: 4_000,
      run: async () => {
        lb.room.dispatch(AddOne({}));
        await lb.flush();
        lb.sinks.length = 0;
      },
    };
  }
);

await scenario(
  'foreign committed frame, 4 pending commands',
  engines,
  async (e) => {
    const { room, transport } = await openClient(e, { connected: true });
    for (let i = 0; i < 4; i++) room.dispatch(AddOne({}));
    let seq = 0;
    return {
      iters: 8_000,
      run: async () => {
        seq += 1;
        transport.deliver({
          v: WIRE_VERSION,
          kind: 'committed',
          entries: [tallyEntry(seq, 'bob', seq)],
        });
        await room.flushIo();
      },
    };
  }
);

await scenario(
  'foreign committed frame after 5k-entry log',
  engines,
  async (e) => {
    const { room, transport } = await openClient(e, { connected: true });
    const warm: unknown[] = [];
    for (let s = 1; s <= 5_000; s++) warm.push(tallyEntry(s, 'bob', s));
    for (let i = 0; i < 5_000; i += 500) {
      transport.deliver({
        v: WIRE_VERSION,
        kind: 'committed',
        entries: warm.slice(i, i + 500),
      });
    }
    await room.flushIo();
    let seq = 5_000;
    return {
      iters: 2_000,
      warmup: 200,
      run: async () => {
        seq += 1;
        transport.deliver({
          v: WIRE_VERSION,
          kind: 'committed',
          entries: [tallyEntry(seq, 'bob', seq)],
        });
        await room.flushIo();
      },
    };
  }
);

await scenario('welcome apply, 512 entries', engines, async (e) => {
  const entries: unknown[] = [];
  for (let s = 1; s <= 512; s++)
    entries.push(tallyEntry(s, `p${String(s % 8)}`, s));
  let opened = await openClient(e, { connected: false });
  return {
    iters: 300,
    warmup: 30,
    run: async () => {
      opened.transport.deliver({
        v: WIRE_VERSION,
        kind: 'welcome',
        fromSeq: 0,
        lastSeq: 512,
        entries,
      });
      await opened.room.flushIo();
      opened.room.destroy();
      opened = await openClient(e, { connected: false });
    },
  };
});

await scenario('hashRoomState, 60-key nested state', engines, async (e) => {
  const state = bigState();
  return { iters: 20_000, run: () => void e.hashRoomState(state) };
});

await scenario('canonicalRoomJson, 60-key nested state', engines, async (e) => {
  const state = bigState();
  return { iters: 20_000, run: () => void e.canonicalRoomJson(state) };
});

print(engines);
