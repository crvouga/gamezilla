import fc from 'fast-check';
import { chaos } from '../../chaos';
import { defineSystem } from '../../define-system';
import type { JsonValue } from '../../json';
import { knob } from '../../knobs';
import { RELIABLE_NET_FAULTS } from '../../network';
import { type PutModel, putAction } from './actions';
import {
  type AcmeKvClientHandle,
  type AcmeKvServerHandle,
  acmeKvClientNode,
  acmeKvServerNode,
  rebroadcastStore,
} from './nodes';
import { storeFingerprint, storeSnapshot } from './types';

const CLIENT_COUNT = knob(2, fc.integer({ min: 2, max: 3 }));

const netChaos = chaos.network({ fromRole: 'client', toRole: 'server' });

function assertConverged(world: {
  readonly nodes: {
    readonly server: AcmeKvServerHandle;
    readonly client: ReadonlyMap<string, AcmeKvClientHandle>;
  };
}): void {
  const serverFp = storeFingerprint(world.nodes.server.store);
  for (const [clientId, client] of world.nodes.client) {
    const clientFp = storeFingerprint(client.cache);
    if (clientFp !== serverFp) {
      throw new Error(
        `acme-kv.diverge: client ${clientId} ${clientFp} !== server ${serverFp}`
      );
    }
  }
}

/** Test-fixture LWW KV over SimNetwork — not a generic store. */
export const ACME_KV_SYSTEM = defineSystem({
  id: 'acme-kv',
  network: {
    faults: RELIABLE_NET_FAULTS,
    edges: [{ fromRole: 'client', toRole: 'server' }],
  },
  knobs: { clientCount: CLIENT_COUNT },
  nodes: {
    server: acmeKvServerNode,
    client: {
      ...acmeKvClientNode,
      count: (k) => k['clientCount'] as number,
      id: (i) => `c${i}`,
    },
  },
  actions: {
    ...netChaos,
    put: putAction,
  },
  model: {
    initial: (): PutModel => ({ map: {} }),
  },
  settle: async (world) => {
    world.healAll();
    rebroadcastStore((world.nodes as { server: AcmeKvServerHandle }).server);
    await world.idle();
    assertConverged(world as unknown as Parameters<typeof assertConverged>[0]);
  },
  invariants: async () => {
    /* safety checks live in settle convergence */
  },
});

export function acmeKvServerFingerprint(server: AcmeKvServerHandle): string {
  return storeFingerprint(server.store);
}

export function acmeKvServerSnapshot(
  server: AcmeKvServerHandle
): Record<string, JsonValue> {
  return storeSnapshot(server.store);
}
