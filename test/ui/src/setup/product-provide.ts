/**
 * Product DST provide map for `@test/ui` — real SQLite / bus / in-memory leaves
 * registered so `api.implement` can resolve sim bindings.
 */

import {
  bindSimPubSubBus,
  registerSimApiTimers,
} from '@apps/api/system/api-resource';
import { registerSimSqlClient } from '@apps/api/system/sim-sql-registry';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { Kv } from '@pkgs/kv/interface';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { PubSub } from '@pkgs/pubsub/interface';
import {
  createInMemoryBus,
  createInMemoryPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBetterSqlite } from '@pkgs/sql-client/sqlite/impl-better-sqlite3';
import { decoratePort, type ProviderSpec, stubPort } from '@pkgs/system';
import BetterSqlite3 from 'better-sqlite3';

import type { SimSqliteHandle } from './boot-sim-sqlite';
import { simNodeTimers } from './sim-actor-overrides';

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
  registerSimApiTimers(simNodeTimers);

  const dbProvider = decoratePort<SqlClient>(async (address) => {
    registerSimSqlClient(address === 'db' ? 'db' : address, {
      sqlite: handles.db.sqlite,
      openRequestDb: handles.db.openRequestDb,
    });
    // Always pin the shared product DB under 'db' for api.implement.
    registerSimSqlClient('db', {
      sqlite: handles.db.sqlite,
      openRequestDb: handles.db.openRequestDb,
    });
    return handles.db.sqlClient;
  });

  const eventsProvider = decoratePort<PubSub>(async (address) => {
    const pubSub = createInMemoryPubSub({ bus: handles.pubSubBus });
    bindSimPubSubBus(
      address === 'events' ? 'events' : address,
      handles.pubSubBus
    );
    bindSimPubSubBus('events', handles.pubSubBus);
    return pubSub;
  });

  return {
    db: dbProvider,
    events: eventsProvider,
    'api.kv': kvProvider(),
    'api.media': blobProvider(),
    'api.payments': stubPort({
      async charge(cents: number, currency: string) {
        return { id: `pay_${cents}_${currency}` };
      },
    }),
    'api.tts': stubPort({
      async synthesize(text: string) {
        return new TextEncoder().encode(`tts:${text}`);
      },
    }),
    'api.llm': stubPort({
      async complete(prompt: string) {
        return `echo:${prompt}`;
      },
    }),
    'api.google': stubPort({
      async getAuthUrl(state: string) {
        return `https://accounts.google.com/o/oauth2?state=${state}`;
      },
    }),
    'client.db': actorSqliteProvider(),
    'client.kv': kvProvider(),
    'client.sentry': stubPort({
      captureException() {},
      captureMessage() {},
    }),
    'room.storage': kvProvider(),
    'room:*.storage': kvProvider(),
  };
}

/** Re-export for callers that need a fresh bus before provide. */
export { createInMemoryBus };
