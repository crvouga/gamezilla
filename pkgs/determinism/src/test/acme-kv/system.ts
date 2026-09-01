import fc from 'fast-check';
import { defineSystem, defineSystemKnob } from '../../define-system';
import type { JsonValue } from '../../json';
import { defineLibrary } from '../../library';
import { RELIABLE_NET_FAULTS } from '../../network';
import type { InvariantViolation } from '../../play';
import type { World } from '../../world-types';
import { arbHeal, arbPartition, arbPut, asRecord } from './actions';
import {
  acmeKvClientNode,
  acmeKvServerNode,
  rebroadcastStore,
  registerAcmeKvNodeKinds,
  sendPut,
} from './nodes';
import {
  ACME_KV_CLIENT_KIND,
  ACME_KV_SERVER_KIND,
  type AcmeKvSystem,
  clientEndpointId,
  createAcmeKvSystem,
  serverEndpointId,
  storeFingerprint,
  storeSnapshot,
} from './types';

registerAcmeKvNodeKinds();
void acmeKvServerNode;
void acmeKvClientNode;

type PutModel = { map: Record<string, string> };

function checkConverged(world: World<AcmeKvSystem>): InvariantViolation | null {
  const serverFp = storeFingerprint(world.system.serverStore);
  for (const clientId of world.roleIds('client')) {
    const cache = world.system.clientCaches.get(clientId);
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
  rebroadcastStore(world.system);
  await world.runUntilIdle();
  const inv = checkConverged(world);
  if (inv !== null) {
    throw new Error(`${inv.invariant}: ${inv.detail}`);
  }
}

/**
 * Test-fixture LWW KV over SimNetwork — not a generic store.
 * SystemDef.id `acme-kv`.
 */
export const ACME_KV_SYSTEM = defineSystem<AcmeKvSystem>({
  id: 'acme-kv',
  system: createAcmeKvSystem,
  network: { defaults: RELIABLE_NET_FAULTS },
  knobs: [
    defineSystemKnob({
      id: 'clientCount',
      default: 2,
      arb: fc.integer({ min: 2, max: 3 }),
    }),
  ],
  nodes: [
    { kind: ACME_KV_SERVER_KIND, role: 'server', count: 1 },
    {
      kind: ACME_KV_CLIENT_KIND,
      role: 'client',
      countFromKnob: 'clientCount',
      idFor: (i) => `c${i}`,
    },
  ],
  library: [
    defineLibrary<AcmeKvSystem>({
      kind: 'partition',
      arb: arbPartition,
      dispatch: async (world, action) => {
        const clientId = String(asRecord(action)['clientId']);
        world.partition(clientEndpointId(clientId), serverEndpointId());
      },
    }),
    defineLibrary<AcmeKvSystem>({
      kind: 'heal',
      arb: arbHeal,
      dispatch: async (world) => {
        world.healAll();
      },
    }),
  ],
  domain: {
    arbs: (ctx) => [arbPut(ctx)],
    dispatch: async (world, op) => {
      const a = asRecord(op);
      if (a['kind'] !== 'put') return;
      sendPut({
        system: world.system,
        clientId: String(a['clientId']),
        key: String(a['key']),
        value: String(a['value']),
      });
    },
  },
  model: {
    initial: (): PutModel => ({ map: {} }),
    allows: () => true,
    apply: (m, a) => {
      const op = asRecord(a);
      if (op['kind'] !== 'put') return;
      (m as PutModel).map[String(op['key'])] = String(op['value']);
    },
  },
  settle: settleAcmeKv,
});

export function acmeKvServerFingerprint(system: AcmeKvSystem): string {
  return storeFingerprint(system.serverStore);
}

export function acmeKvServerSnapshot(
  system: AcmeKvSystem
): Record<string, JsonValue> {
  return storeSnapshot(system.serverStore);
}
