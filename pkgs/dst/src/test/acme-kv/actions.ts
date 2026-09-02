import fc from 'fast-check';

import { actions } from '../../harness/actions';
import type { AcmeKvClientHandle, AcmeKvServerHandle } from './nodes';
import { sendPut } from './nodes';
import type { KvExtension, KvSurface } from './surface';
import { storeFingerprint } from './types';

const KEYS = ['a', 'b', 'c'] as const;
const VALUES = ['x', 'y', 'z', ''] as const;

export type PutAction = {
  readonly kind: 'put';
  readonly clientId: string;
  readonly key: string;
  readonly value: string;
  readonly writeId?: number;
};

export const kvActions = actions<KvSurface>()({
  put: {
    weight: 3,
    generate: (ctx) => {
      const clients = ctx.nodeIds('client');
      if (clients.length === 0) {
        return fc.constant({
          kind: 'put' as const,
          clientId: 'c0',
          key: 'a',
          value: 'x',
        });
      }
      return fc.record({
        kind: fc.constant('put' as const),
        clientId: fc.constantFrom(...clients),
        key: fc.constantFrom(...KEYS),
        value: fc.constantFrom(...VALUES),
        writeId: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
      });
    },
    apply: async (surface, payload) => {
      await surface.put(
        (payload as PutAction).clientId,
        (payload as PutAction).key,
        (payload as PutAction).value,
        (payload as PutAction).writeId
      );
    },
  },
});

export function createKvExtension(world: {
  readonly nodes: {
    readonly server: AcmeKvServerHandle;
    readonly client: ReadonlyMap<string, AcmeKvClientHandle>;
  };
}): KvExtension {
  return {
    knownKeys: () => KEYS,
    async put(clientId, key, value, writeId) {
      const client = world.nodes.client.get(clientId);
      if (client === undefined) return;
      sendPut({
        server: world.nodes.server,
        client,
        key,
        value,
        ...(writeId !== undefined ? { writeId } : {}),
      });
    },
    versionsMonotonic() {
      for (const [, entry] of world.nodes.server.store) {
        if (entry.writeId < 0) return false;
      }
      return true;
    },
    cachesEqualServer() {
      const fp = storeFingerprint(world.nodes.server.store);
      for (const [, client] of world.nodes.client) {
        if (storeFingerprint(client.cache) !== fp) return false;
      }
      return true;
    },
    sawTiebreak: () => world.nodes.server.sawTiebreak,
  };
}
