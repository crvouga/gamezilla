import fc from 'fast-check';
import { defineScenario } from '../../harness/define-scenario';
import { knob } from '../../harness/knobs';
import { networkCommands } from '../../harness/network-commands';
import type { JsonValue } from '../../kernel/json';
import { RELIABLE_NETWORK } from '../../models/network';
import { type PutModel, putCommand } from './commands';
import {
  type AcmeKvClientHandle,
  type AcmeKvServerHandle,
  acmeKvClientNode,
  acmeKvServerNode,
  rebroadcastStore,
} from './nodes';
import { storeFingerprint, storeSnapshot } from './types';

const CLIENT_COUNT = knob(2, fc.integer({ min: 2, max: 3 }));

const netCommands = networkCommands({ fromRole: 'client', toRole: 'server' });

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

/** Test-fixture LWW KV over Network — not a generic store. */
export const ACME_KV_SCENARIO = defineScenario({
  id: 'acme-kv',
  network: {
    faults: RELIABLE_NETWORK,
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
  commands: {
    ...netCommands,
    put: putCommand,
  },
  referenceModel: {
    initial: (): PutModel => ({ map: {} }),
  },
  converge: async (world) => {
    world.healAll();
    rebroadcastStore((world.nodes as { server: AcmeKvServerHandle }).server);
    await world.quiesce();
    assertConverged(world as unknown as Parameters<typeof assertConverged>[0]);
  },
  always: async () => {
    /* safety checks live in converge */
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
