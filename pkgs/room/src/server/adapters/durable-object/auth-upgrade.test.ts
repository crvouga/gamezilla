import { describe, expect, test } from 'bun:test';
import { wallClock } from '@pkgs/clock';

import { TestCounterModule } from '../../../tests/fixtures/counter-module';
import { createDurableObjectAdapter } from './adapter';
import type {
  DurableObjectInstanceState,
  DurableObjectKvListOptions,
  DurableObjectKvStorage,
} from './types';

function createMemoryDoKv(): DurableObjectKvStorage {
  const map = new Map<string, unknown>();
  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return map.get(key) as T | undefined;
    },
    async put(
      keyOrEntries: string | Record<string, unknown>,
      value?: unknown
    ): Promise<void> {
      if (typeof keyOrEntries === 'string') {
        map.set(keyOrEntries, value);
        return;
      }
      for (const [k, v] of Object.entries(keyOrEntries)) map.set(k, v);
    },
    async delete(key: string): Promise<boolean> {
      return map.delete(key);
    },
    async list<T = unknown>(
      options?: DurableObjectKvListOptions
    ): Promise<Map<string, T>> {
      const out = new Map<string, T>();
      for (const k of [...map.keys()].sort()) {
        if (options?.prefix !== undefined && !k.startsWith(options.prefix)) {
          continue;
        }
        out.set(k, map.get(k) as T);
      }
      return out;
    },
  };
}

function createFakeDoState(
  storage: DurableObjectKvStorage
): DurableObjectInstanceState {
  return {
    storage,
    acceptWebSocket(): void {},
    getWebSockets(): WebSocket[] {
      return [];
    },
    async blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    },
  };
}

describe('Durable Object auth at upgrade', () => {
  test('missing identity header → 401', async () => {
    const RoomDo = createDurableObjectAdapter({
      modules: [TestCounterModule],
      clock: wallClock,
      createId: () => crypto.randomUUID(),
    });
    const doInstance = new RoomDo(createFakeDoState(createMemoryDoKv()), {});
    const res = await doInstance.fetch(
      new Request(
        `https://room.test/ws?topic=t&module=${String(TestCounterModule.name)}`,
        { headers: { Upgrade: 'websocket' } }
      )
    );
    expect(res.status).toBe(401);
  });
});
