import { defineScenario } from '@pkgs/dst';

import { SCHEMA_ACTIONS, type SchemaModel } from './actions';
import {
  assertClientAlignedWithServer,
  assertServerLiveColumns,
} from './invariants';
import {
  SCHEMA_CLIENT_COUNT,
  schemaClientNode,
  schemaServerNode,
} from './nodes';
import type { SchemaPeer } from './peers';
import { planKindHash, requireServer, SCHEMA_SERVER_ID } from './peers';

export { SCHEMA_SERVER_ID };

const PLAN_HASH_HEX_LENGTH = 64;

/**
 * One `schema.server` (postgres-mem) plus N `schema.client` (sqlite-mem) peers
 * walking a compatible expand/contract chain at independent versions.
 */
export const SCHEMA_SYSTEM = defineScenario({
  id: 'db-schema.reconcile',
  knobs: {
    clientCount: SCHEMA_CLIENT_COUNT,
  },
  nodes: {
    server: {
      ...schemaServerNode,
      id: () => SCHEMA_SERVER_ID,
    },
    client: {
      ...schemaClientNode,
      count: (k) => k['clientCount'] as number,
      id: (i) => `client-${i}`,
    },
  },
  commands: SCHEMA_ACTIONS,
  referenceModel: {
    initial: (): SchemaModel => ({}),
  },
  always: async () => {
    /* safety checks run in settle */
  },
  converge: async (world) => {
    const server = requireServer(world.nodes['server'] as SchemaPeer);
    await assertServerLiveColumns(server);
    const clients = world.nodes['client'] as unknown as ReadonlyMap<
      string,
      SchemaPeer
    >;
    for (const client of clients.values()) {
      await assertClientAlignedWithServer(client, server);
    }
    if (planKindHash(server).length !== PLAN_HASH_HEX_LENGTH) {
      throw new Error('server plan hash is not a sha256 hex digest');
    }
  },
});

export type SchemaWorld = import('@pkgs/dst').World<
  typeof SCHEMA_SYSTEM.knobs,
  typeof SCHEMA_SYSTEM.nodes
>;
