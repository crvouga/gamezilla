import { describe, expect, it } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';
import { asKeyword } from '@pkgs/keyword';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import {
  Increment,
  TestCounterModule,
} from '../../tests/fixtures/counter-module';
import { InMemoryClientStorage } from '../adapters/storage/memory';
import { RoomClient } from './room-client';
import { RoomMetaAttr } from './room-meta';
import type { ClientTransport, ClientTransportHandlers } from './transport';

const timers = wallTimers;

/**
 * Transport that never opens — simulates Connecting… / offline.
 * `connect()` can optionally throw to prove RoomClient.open still returns.
 */
class OfflineClientTransport implements ClientTransport {
  readonly sent: unknown[] = [];
  private readonly handlers = new Set<(raw: unknown) => void>();
  private readonly handlerSets: ClientTransportHandlers[] = [];
  throwOnConnect = false;
  opened = false;

  get isConnected(): boolean {
    return this.opened;
  }

  connect(): void {
    if (this.throwOnConnect) {
      throw new Error('WebSocket unavailable');
    }
  }

  openAndWelcome(lastSeq = 0): void {
    this.opened = true;
    for (const h of this.handlerSets) h.onOpen?.();
    for (const h of [...this.handlers]) {
      h({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.welcome,
        fromSeq: 0,
        lastSeq,
        entries: [],
      });
    }
  }

  sendJson(payload: unknown): void {
    this.sent.push(payload);
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

describe('RoomClient offline-first dispatch', () => {
  it('returns a usable RoomClient when transport.connect throws', async () => {
    const transport = new OfflineClientTransport();
    transport.throwOnConnect = true;
    const room = await RoomClient.open({
      topic: 't-connect-throw',
      module: TestCounterModule,
      storage: new InMemoryClientStorage(),
      transport,
      identity: 'u1',
      clock: wallClock,
      timers: wallTimers,
      createId: () => crypto.randomUUID(),
    });
    expect(RoomMetaAttr.isConnected.from(room.getSnapshot())).toBe(false);
    expect(RoomMetaAttr.isSynced.from(room.getSnapshot())).toBe(false);
    room.destroy();
    transport.destroy();
  });

  it('applies optimistic domain state while disconnected and queues outbound', async () => {
    const transport = new OfflineClientTransport();
    const storage = new InMemoryClientStorage();
    const room = await RoomClient.open({
      topic: 't-offline-dispatch',
      module: TestCounterModule,
      storage,
      transport,
      identity: 'u1',
      clock: wallClock,
      timers: wallTimers,
      createId: () => crypto.randomUUID(),
    });

    expect(RoomMetaAttr.isConnected.from(room.getSnapshot())).toBe(false);
    const countKey = asKeyword('counter/count');
    expect(room.getSnapshot()[countKey]).toBe(0);

    room.dispatch(Increment({}));
    expect(room.getSnapshot()[countKey]).toBe(1);
    expect(transport.sent.length).toBe(0);

    // Durable append is async (dispatchSerial); wait for it.
    await new Promise<void>((r) => timers.setTimeout(r, 10));
    const queued = await storage.loadQueued();
    expect(queued.length).toBe(1);

    transport.openAndWelcome();
    await room.untilSynced();
    // After welcome, outbound queue flushes.
    await new Promise<void>((r) => timers.setTimeout(r, 10));
    expect(
      transport.sent.some((f) => {
        const frame = f as { kind?: string };
        return frame.kind === ROOM_WIRE_KIND.command;
      })
    ).toBe(true);

    room.destroy();
    transport.destroy();
  });
});
