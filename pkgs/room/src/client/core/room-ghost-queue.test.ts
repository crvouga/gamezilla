import { describe, expect, it } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';
import { asKeyword } from '@pkgs/keyword';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import {
  Increment,
  TestCounterModule,
} from '../../tests/fixtures/counter-module';
import type { LogEntry } from '../../types';
import { InMemoryClientStorage } from '../adapters/storage/memory';
import { RoomClient } from './room-client';
import type { ClientRoomStorage, QueuedCommand } from './storage';
import type { ClientTransport, ClientTransportHandlers } from './transport';

/**
 * Storage that delays appendQueued so a fast committed ack can race ahead
 * of the durable persist (the ghost-queue bug before IO serial).
 */
class SlowAppendStorage implements ClientRoomStorage {
  readonly inner = new InMemoryClientStorage();
  private appendGate: Promise<void> = Promise.resolve();
  private releaseAppend: (() => void) | null = null;

  holdNextAppend(): void {
    this.appendGate = new Promise<void>((resolve) => {
      this.releaseAppend = resolve;
    });
  }

  releaseHeldAppend(): void {
    this.releaseAppend?.();
    this.releaseAppend = null;
    this.appendGate = Promise.resolve();
  }

  loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    return this.inner.loadCommitted();
  }

  saveCommitted(lastSeq: number, entries: LogEntry[]): Promise<void> {
    return this.inner.saveCommitted(lastSeq, entries);
  }

  loadQueued(): Promise<QueuedCommand[]> {
    return this.inner.loadQueued();
  }

  async appendQueued(cmd: QueuedCommand): Promise<void> {
    await this.appendGate;
    await this.inner.appendQueued(cmd);
  }

  removeQueued(id: string): Promise<void> {
    return this.inner.removeQueued(id);
  }
}

function createInjectTransport(): ClientTransport & {
  readonly sent: unknown[];
  inject(raw: unknown): void;
} {
  const sent: unknown[] = [];
  const handlers = new Set<(raw: unknown) => void>();
  const handlerSets: ClientTransportHandlers[] = [];
  let opened = false;

  return {
    sent,
    get isConnected() {
      return opened;
    },
    connect() {
      opened = true;
      for (const h of handlerSets) h.onOpen?.();
    },
    inject(raw: unknown) {
      for (const h of [...handlers]) h(raw);
    },
    sendJson(payload: unknown) {
      sent.push(payload);
    },
    subscribe(handler: (raw: unknown) => void) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    onHandlers(h: ClientTransportHandlers) {
      handlerSets.push(h);
      return () => {
        const i = handlerSets.indexOf(h);
        if (i >= 0) handlerSets.splice(i, 1);
      };
    },
    destroy() {
      handlers.clear();
      handlerSets.length = 0;
      opened = false;
    },
  };
}

describe('RoomClient ghost durable queue', () => {
  it('committed ack before appendQueued leaves durable queue empty', async () => {
    const storage = new SlowAppendStorage();
    const transport = createInjectTransport();
    let n = 0;
    const room = await RoomClient.open({
      topic: 't-ghost-queue',
      module: TestCounterModule,
      storage,
      transport,
      identity: 'u1',
      clock: wallClock,
      timers: wallTimers,
      createId: () => `cmd-${++n}`,
    });

    transport.inject({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: 0,
      lastSeq: 0,
      entries: [],
    });
    await room.untilSynced();
    await room.flushIo();

    storage.holdNextAppend();
    room.dispatch(Increment({}));
    const countKey = asKeyword('counter/count');
    expect(room.getSnapshot()[countKey]).toBe(1);
    expect(room.getPendingQueueIds()).toEqual(['cmd-1']);

    // Ack arrives while appendQueued is still gated — must join IO serial.
    transport.inject({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.committed,
      commandId: 'cmd-1',
      entries: [
        {
          seq: 1,
          event: {
            type: 'space-counter-evt/counter-incremented',
            payload: {},
          },
          actor: { id: 'u1', clientId: 'c1' },
          ts: wallClock.now(),
        },
      ],
    });

    storage.releaseHeldAppend();
    await room.flushIo();

    expect(room.getPendingQueueIds()).toEqual([]);
    await expect(storage.loadQueued()).resolves.toEqual([]);
    expect(room.getSnapshot()[countKey]).toBe(1);

    room.destroy();
    transport.destroy();
  });
});
