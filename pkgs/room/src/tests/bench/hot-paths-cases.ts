import { wallClock, wallTimers } from '@pkgs/clock';
import { asKeyword } from '@pkgs/keyword';

import { InMemoryClientStorage } from '../../client/adapters/storage/memory';
import { RoomClient } from '../../client/core/room-client';
import type {
  ClientTransport,
  ClientTransportHandlers,
} from '../../client/core/transport';
import { hashRoomState } from '../../hash-room-state';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import type { LogEntry, RoomState } from '../../types';
import {
  CounterIncremented,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

export type BenchCase = {
  readonly name: string;
  readonly run: () => Promise<void> | void;
};

class NullTransport implements ClientTransport {
  private readonly handlers = new Set<(raw: unknown) => void>();
  private readonly handlerSets: ClientTransportHandlers[] = [];
  opened = true;

  get isConnected(): boolean {
    return this.opened;
  }

  connect(): void {
    this.opened = true;
  }

  sendJson(_payload: unknown): void {}

  inject(raw: unknown): void {
    for (const h of [...this.handlers]) h(raw);
  }

  subscribe(handler: (raw: unknown) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  onHandlers(h: ClientTransportHandlers): () => void {
    this.handlerSets.push(h);
    return () => {
      const i = this.handlerSets.indexOf(h);
      if (i >= 0) this.handlerSets.splice(i, 1);
    };
  }

  destroy(): void {
    this.handlers.clear();
    this.handlerSets.length = 0;
    this.opened = false;
  }
}

function nestedState(depth: number): RoomState {
  const root: Record<string, unknown> = {};
  let cur = root;
  for (let i = 0; i < depth; i++) {
    const next: Record<string, unknown> = { n: i, xs: [i, i + 1, i + 2] };
    cur[asKeyword(`bench/k${i}`)] = next;
    cur = next;
  }
  return root as RoomState;
}

function logEntries(n: number): LogEntry[] {
  const out: LogEntry[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({
      seq: i,
      event: CounterIncremented({}),
      actor: { id: 'u', clientId: 'c' },
      ts: i,
    });
  }
  return out;
}

export async function createHotPathCases(): Promise<BenchCase[]> {
  let idN = 0;
  const createId = () => `bench-${++idN}`;
  return [
    {
      name: 'dispatch-burst-64',
      run: async () => {
        const transport = new NullTransport();
        const room = await RoomClient.open({
          topic: 'bench-dispatch',
          module: TestCounterModule,
          storage: new InMemoryClientStorage(),
          transport,
          identity: 'u1',
          clock: wallClock,
          timers: wallTimers,
          createId,
        });
        transport.inject({
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.welcome,
          fromSeq: 0,
          lastSeq: 0,
          entries: [],
        });
        await room.untilSynced();
        for (let i = 0; i < 64; i++) room.dispatch(Increment({}));
        await room.flushIo();
        room.destroy();
      },
    },
    {
      name: 'welcome-apply-256',
      run: async () => {
        const transport = new NullTransport();
        const room = await RoomClient.open({
          topic: 'bench-welcome',
          module: TestCounterModule,
          storage: new InMemoryClientStorage(),
          transport,
          identity: 'u1',
          clock: wallClock,
          timers: wallTimers,
          createId,
        });
        transport.inject({
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.welcome,
          fromSeq: 0,
          lastSeq: 256,
          entries: logEntries(256),
        });
        await room.untilSynced();
        await room.flushIo();
        room.destroy();
      },
    },
    {
      name: 'hashRoomState-nested-32',
      run: () => {
        const state = nestedState(32);
        for (let i = 0; i < 100; i++) hashRoomState(state);
      },
    },
  ];
}
