import fc from 'fast-check';
import type { ActionCatalog } from '../../harness/actions';
import { defineScenario } from '../../harness/define-scenario';
import { knob } from '../../harness/knobs';
import { nodeCount } from '../../harness/node';
import { properties, property } from '../../harness/property';
import { std } from '../../harness/std';
import type { JsonValue } from '../../kernel/json';
import { RELIABLE_NETWORK } from '../../models/network';
import { createKvExtension, kvActions } from './actions';
import {
  type AcmeKvClientHandle,
  type AcmeKvServerHandle,
  acmeKvClientNode,
  acmeKvServerNode,
  rebroadcastStore,
} from './nodes';
import type { KvSurface } from './surface';
import { storeFingerprint, storeSnapshot } from './types';

const CLIENT_COUNT = knob(2, fc.integer({ min: 2, max: 3 }));

type AcmeKvKnobs = { readonly clientCount: typeof CLIENT_COUNT };

const kvProps = properties<KvSurface>()({
  storeVersionsMonotonic: property.always((s) => s.versionsMonotonic()),
  cachesMatchServer: property.always((s) => s.cachesEqualServer(), {
    at: 'converge',
  }),
  lwwTiebreakExercised: property.sometimes((s) => s.sawTiebreak()),
});

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
      count: nodeCount<AcmeKvKnobs>((k) => k.clientCount),
      id: (i) => `c${i}`,
    },
  },
  actions: {
    ...std.network({ fromRole: 'client', toRole: 'server' }),
    ...std.time(),
    ...kvActions,
  } as ActionCatalog<KvSurface>,
  properties: kvProps,
  converge: async (world) => {
    world.healAll();
    rebroadcastStore((world.nodes as { server: AcmeKvServerHandle }).server);
    await world.quiesce();
  },
  extend: async (world) =>
    createKvExtension({
      nodes: world.nodes as {
        readonly server: AcmeKvServerHandle;
        readonly client: ReadonlyMap<string, AcmeKvClientHandle>;
      },
    }),
} as import('../../harness/define-scenario').AnyScenarioDef);

export function acmeKvServerFingerprint(server: AcmeKvServerHandle): string {
  return storeFingerprint(server.store);
}

export function acmeKvServerSnapshot(
  server: AcmeKvServerHandle
): Record<string, JsonValue> {
  return storeSnapshot(server.store);
}

export type { AcmeKvClientHandle, AcmeKvServerHandle, KvSurface };
