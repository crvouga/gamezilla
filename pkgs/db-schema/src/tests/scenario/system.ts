import {
  type ActionCatalog,
  defineScenario,
  nodeCount,
  properties,
  property,
} from '@pkgs/dst';

import { SCHEMA_ACTIONS } from './actions';
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
import type { SchemaKnobs, SchemaSurface } from './types';

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
  } satisfies SchemaKnobs,
  nodes: {
    server: {
      ...schemaServerNode,
      id: () => SCHEMA_SERVER_ID,
    },
    client: {
      ...schemaClientNode,
      count: nodeCount<SchemaKnobs>((k) => k.clientCount),
      id: (i) => `client-${i}`,
    },
  },
  actions: SCHEMA_ACTIONS as unknown as ActionCatalog<SchemaSurface>,
  properties: properties<SchemaSurface>()({
    alignedAtConverge: property.always(async () => true, { at: 'converge' }),
  }),
  converge: async (world) => {
    const schemaWorld = world as SchemaSurface;
    const server = requireServer(schemaWorld.nodes['server'] as SchemaPeer);
    await assertServerLiveColumns(server);
    const clients = schemaWorld.nodes['client'] as unknown as ReadonlyMap<
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
} as import('@pkgs/dst').AnyScenarioDef);

export type SchemaWorld = SchemaSurface;
