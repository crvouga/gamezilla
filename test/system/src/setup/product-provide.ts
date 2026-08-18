/**
 * Product DST provide map for `@test/system` — leaf adapters only (no registries).
 */

import { attachSimOpenRequestDb } from '@apps/api/system/sim-open-request-db';
import { createInMemoryStripe } from '@libs/stripe/root/in-memory-stripe';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { Kv } from '@pkgs/kv/interface';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import type { PubSub } from '@pkgs/pubsub/interface';
import {
  createInMemoryBus,
  createInMemoryPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBetterSqlite } from '@pkgs/sql-client/sqlite/impl-better-sqlite3';
import { decoratePort, type ProviderSpec, stubPort } from '@pkgs/system';
import { InMemoryTtsProvider } from '@pkgs/tts/server';
import BetterSqlite3 from 'better-sqlite3';

import type { SimSqliteHandle } from './boot-sim-sqlite';

export type ProductProvideHandles = {
  readonly db: SimSqliteHandle;
  readonly pubSubBus: InMemoryBus;
};

function kvProvider(): ProviderSpec<Kv> {
  return decoratePort<Kv>(() => new KvImplInMemory(), {
    wipe(instance) {
      if (instance instanceof KvImplInMemory) instance.clearForTest();
    },
    corrupt(instance) {
      if (instance instanceof KvImplInMemory) {
        instance.armFault(new Error('kv corrupted'));
      }
    },
  });
}

function blobProvider(): ProviderSpec<ObjectStore> {
  return decoratePort<ObjectStore>(() => new ObjectStoreImplInMemory(), {
    corrupt(instance) {
      if (instance instanceof ObjectStoreImplInMemory) {
        instance.armFault(new Error('blob corrupted'));
      }
    },
  });
}

function actorSqliteProvider(): ProviderSpec<SqlClient> {
  return decoratePort<SqlClient>(async () => {
    const sqlite = new BetterSqlite3(':memory:');
    const client = new SqlClientImplBetterSqlite(sqlite);
    await client.connect();
    return client;
  });
}

/**
 * Build the DST provide map bound to a booted sim SQLite + shared pubsub bus.
 */
export function createProductProvide(
  handles: ProductProvideHandles
): Record<string, ProviderSpec> {
  const dbProvider = decoratePort<SqlClient>(async () => {
    return attachSimOpenRequestDb(
      handles.db.sqlClient,
      handles.db.openRequestDb
    );
  });

  const eventsProvider = decoratePort<PubSub>(async () => {
    return createInMemoryPubSub({ bus: handles.pubSubBus });
  });

  return {
    db: dbProvider,
    events: eventsProvider,
    'api.kv': kvProvider(),
    'api.media': blobProvider(),
    'api.payments': stubPort(
      createInMemoryStripe({ baseUrl: 'http://sim.local' })
    ),
    'api.tts': stubPort(new InMemoryTtsProvider()),
    'api.llm': stubPort(new InMemoryLlmProvider()),
    'client.db': actorSqliteProvider(),
    'client.kv': kvProvider(),
    'client.observability': stubPort(createNoopObservability('sim-client')),
    'room.storage': kvProvider(),
    'room:*.storage': kvProvider(),
  };
}

/** Re-export for callers that need a fresh bus before provide. */
export { createInMemoryBus };
