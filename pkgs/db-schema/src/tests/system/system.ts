import { defineSystem, defineSystemKnob } from '@pkgs/determinism';
import fc from 'fast-check';

import { arbSchemaActions } from './actions';
import { dispatchSchemaAction } from './dispatch';
import {
  assertClientAlignedWithServer,
  assertServerLiveColumns,
  checkServerLiveColumns,
} from './invariants';
import { SCHEMA_CLIENT_KIND, SCHEMA_SERVER_KIND } from './nodes';
import {
  createSchemaSystem,
  planKindHash,
  requireServer,
  type SchemaSystem,
} from './peers';

export const SCHEMA_SERVER_ID = 'server';
const PLAN_HASH_HEX_LENGTH = 64;

/**
 * One `schema.server` (postgres-mem) plus N `schema.client` (sqlite-mem) peers
 * walking a compatible expand/contract chain at independent versions.
 */
export const SCHEMA_SYSTEM = defineSystem<SchemaSystem>({
  id: 'db-schema.reconcile',
  system: createSchemaSystem,
  knobs: [
    defineSystemKnob<number>({
      id: 'clientCount',
      default: 2,
      arb: fc.integer({ min: 1, max: 3 }),
    }),
  ],
  nodes: [
    {
      kind: SCHEMA_SERVER_KIND,
      role: 'server',
      count: 1,
      idFor: () => SCHEMA_SERVER_ID,
    },
    {
      kind: SCHEMA_CLIENT_KIND,
      role: 'client',
      countFromKnob: 'clientCount',
      idFor: (i) => `client-${i}`,
    },
  ],
  domain: {
    arbs: (ctx) =>
      arbSchemaActions([SCHEMA_SERVER_ID, ...ctx.roleIds('client')]),
    dispatch: dispatchSchemaAction,
  },
  checkInvariants: async (world) =>
    checkServerLiveColumns(requireServer(world.system)),
  settle: async (world) => {
    const server = requireServer(world.system);
    await assertServerLiveColumns(server);
    for (const client of world.system.clients) {
      await assertClientAlignedWithServer(client, server);
    }
    if (planKindHash(server).length !== PLAN_HASH_HEX_LENGTH) {
      throw new Error('server plan hash is not a sha256 hex digest');
    }
  },
});
