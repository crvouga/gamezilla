import fc from 'fast-check';
import { defineSystem } from '../../define-system';
import type { JsonValue } from '../../json';
import { defineKnob } from '../../knobs';
import { RELIABLE_NET_FAULTS } from '../../network';
import type { InvariantViolation } from '../../play';
import { stdNetChaos } from '../../std-actions';
import type { World } from '../../world-types';
import { type PutModel, putAction } from './actions';
import { acmeKvClientNode, acmeKvServerNode, rebroadcastStore } from './nodes';
import {
  type AcmeKvSystem,
  createAcmeKvSystem,
  storeFingerprint,
  storeSnapshot,
} from './types';

function checkConverged(world: World<AcmeKvSystem>): InvariantViolation | null {
  const serverFp = storeFingerprint(world.state.serverStore);
  for (const clientId of world.roleIds('client')) {
    const cache = world.state.clientCaches.get(clientId);
    if (cache === undefined) {
      return {
        invariant: 'acme-kv.missing-cache',
        detail: `no cache for ${clientId}`,
      };
    }
    const clientFp = storeFingerprint(cache);
    if (clientFp !== serverFp) {
      return {
        invariant: 'acme-kv.diverge',
        detail: `client ${clientId} ${clientFp} !== server ${serverFp}`,
      };
    }
  }
  return null;
}

async function settleAcmeKv(world: World<AcmeKvSystem>): Promise<void> {
  world.healAll();
  rebroadcastStore(world.state);
  await world.idle();
}

/**
 * Test-fixture LWW KV over SimNetwork — not a generic store.
 * SystemDef.id `acme-kv`.
 */
export const ACME_KV_SYSTEM = defineSystem<AcmeKvSystem, PutModel>({
  id: 'acme-kv',
  state: createAcmeKvSystem,
  network: {
    defaults: RELIABLE_NET_FAULTS,
    edges: [{ fromRole: 'client', toRole: 'server' }],
  },
  knobs: [
    defineKnob({
      id: 'clientCount',
      default: 2,
      arb: fc.integer({ min: 2, max: 3 }),
    }),
  ],
  nodes: [
    { kind: acmeKvServerNode, role: 'server', count: 1 },
    {
      kind: acmeKvClientNode,
      role: 'client',
      count: { fromKnob: 'clientCount' },
      idFor: (i) => `c${i}`,
    },
  ],
  actions: [...stdNetChaos<AcmeKvSystem>(), putAction],
  model: {
    initial: (): PutModel => ({ map: {} }),
  },
  settle: settleAcmeKv,
  invariants: async (world) => checkConverged(world),
});

export function acmeKvServerFingerprint(state: AcmeKvSystem): string {
  return storeFingerprint(state.serverStore);
}

export function acmeKvServerSnapshot(
  state: AcmeKvSystem
): Record<string, JsonValue> {
  return storeSnapshot(state.serverStore);
}
