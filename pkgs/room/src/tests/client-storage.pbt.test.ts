import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import fc from 'fast-check';
import { keyValueRoomClientKeywords } from '../client/adapters/storage/key-value/keys';
import { KeyValueClientRoomStorage } from '../client/adapters/storage/key-value/storage';
import { InMemoryClientStorage } from '../client/adapters/storage/memory';
import { WebClientStorage } from '../client/adapters/storage/web/storage';
import type { ClientRoomStorage, QueuedCommand } from '../client/core/storage';
import { Increment } from './fixtures/counter-module';

const arbQueuedCommand = (): fc.Arbitrary<QueuedCommand> =>
  fc.record({
    id: fc.uuid(),
    ts: fc.integer({ min: 0, max: 1e12 }),
    payload: fc.constant(Increment({})),
  });

type Adapter = {
  readonly label: string;
  readonly create: () => ClientRoomStorage;
};

function adapters(): Adapter[] {
  let kvN = 0;
  return [
    {
      label: 'memory',
      create: () => new InMemoryClientStorage(),
    },
    {
      label: 'web',
      create: () => {
        const map = new Map<string, string>();
        const fake: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
          getItem: (k) => map.get(k) ?? null,
          setItem: (k, v) => {
            map.set(k, v);
          },
          removeItem: (k) => {
            map.delete(k);
          },
        };
        return new WebClientStorage('pbt', fake);
      },
    },
    {
      label: 'kv',
      create: () => {
        kvN += 1;
        const { committed, queue } = keyValueRoomClientKeywords(
          `pbt${String(kvN)}`
        );
        return new KeyValueClientRoomStorage(
          new KvImplInMemory(),
          committed,
          queue
        );
      },
    },
  ];
}

describe('client storage PBT', () => {
  for (const adapter of adapters()) {
    test(`${adapter.label}: append/remove round-trip`, async () => {
      await assertProperty(
        `${adapter.label} queue append/remove`,
        fc.asyncProperty(
          fc.array(arbQueuedCommand(), { minLength: 1, maxLength: 8 }),
          async (cmds) => {
            const storage = adapter.create();
            for (const c of cmds) await storage.appendQueued(c);
            const loaded = await storage.loadQueued();
            expect(loaded.map((q) => q.id)).toEqual(cmds.map((c) => c.id));
            for (const c of cmds) await storage.removeQueued(c.id);
            await expect(storage.loadQueued()).resolves.toEqual([]);
          }
        ),
        { numRuns: 12 }
      );
    });

    test(`${adapter.label}: serial append then remove of same id leaves empty`, async () => {
      await assertProperty(
        `${adapter.label} append/remove serial`,
        fc.asyncProperty(arbQueuedCommand(), async (cmd) => {
          const storage = adapter.create();
          let chain: Promise<void> = Promise.resolve();
          chain = chain.then(() => storage.appendQueued(cmd));
          chain = chain.then(() => storage.removeQueued(cmd.id));
          await chain;
          await expect(storage.loadQueued()).resolves.toEqual([]);
        }),
        { numRuns: 20 }
      );
    });
  }
});
