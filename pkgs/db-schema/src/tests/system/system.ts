import { defineKnob, defineSystem } from '@pkgs/determinism';
import fc from 'fast-check';

import { SCHEMA_ACTIONS, type SchemaModel } from './actions';
import {
  assertClientAlignedWithServer,
  assertServerLiveColumns,
  checkServerLiveColumns,
} from './invariants';
import { schemaClientNode, schemaServerNode } from './nodes';
import {
  createSchemaSystem,
  planKindHash,
  requireServer,
  SCHEMA_SERVER_ID,
  type SchemaSystem,
} from './peers';

export { SCHEMA_SERVER_ID };

const PLAN_HASH_HEX_LENGTH = 64;

/**
 * One `schema.server` (postgres-mem) plus N `schema.client` (sqlite-mem) peers
 * walking a compatible expand/contract chain at independent versions.
 */
export const SCHEMA_SYSTEM = defineSystem<SchemaSystem, SchemaModel>({
  id: 'db-schema.reconcile',
  state: createSchemaSystem,
  knobs: [
    defineKnob({
      id: 'clientCount',
      default: 2,
      arb: fc.integer({ min: 1, max: 3 }),
    }),
  ],
  nodes: [
    {
      kind: schemaServerNode,
      role: 'server',
      count: 1,
      idFor: () => SCHEMA_SERVER_ID,
    },
    {
      kind: schemaClientNode,
      role: 'client',
      count: { fromKnob: 'clientCount' },
      idFor: (i) => `client-${i}`,
    },
  ],
  actions: [...SCHEMA_ACTIONS],
  model: {
    initial: (): SchemaModel => ({}),
  },
  invariants: async (world) =>
    checkServerLiveColumns(requireServer(world.state)),
  settle: async (world) => {
    const server = requireServer(world.state);
    await assertServerLiveColumns(server);
    for (const client of world.state.clients) {
      await assertClientAlignedWithServer(client, server);
    }
    if (planKindHash(server).length !== PLAN_HASH_HEX_LENGTH) {
      throw new Error('server plan hash is not a sha256 hex digest');
    }
  },
});
