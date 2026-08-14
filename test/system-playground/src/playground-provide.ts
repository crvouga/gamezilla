/**
 * Browser-safe DST provide map — SqlClient only (no better-sqlite3).
 */

import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import { attachSimOpenRequestDb } from '@apps/api/system/sim-open-request-db';
import { createInMemoryStripe } from '@libs/stripe/in-memory-stripe';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { Kv } from '@pkgs/kv/interface';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import type { PubSub } from '@pkgs/pubsub/interface';
import {
  createInMemoryPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { decoratePort, type ProviderSpec, stubPort } from '@pkgs/system';
import { InMemoryTtsProvider } from '@pkgs/tts/server';

export type PlaygroundProvideHandles = {
  readonly sqlClient: SqlClient;
  readonly openRequestDb: OpenRequestDb;
  readonly pubSubBus: InMemoryBus;
};

function kvProvider(): ProviderSpec<Kv> {
  return decoratePort<Kv>(() => new KvImplInMemory(), {});
}

function blobProvider(): ProviderSpec<ObjectStore> {
  return decoratePort<ObjectStore>(() => new ObjectStoreImplInMemory(), {});
}

export function createPlaygroundProvide(
  handles: PlaygroundProvideHandles
): Record<string, ProviderSpec> {
  const dbProvider = decoratePort<SqlClient>(async () => {
    return attachSimOpenRequestDb(handles.sqlClient, handles.openRequestDb);
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
    'client.db': decoratePort<SqlClient>(async () => {
      throw new Error(
        'playground: client.db is opened via App seams, not the graph provide'
      );
    }),
    'client.kv': kvProvider(),
    'client.observability': stubPort(
      createNoopObservability('sim-client-playground')
    ),
    'room.storage': kvProvider(),
    'room:*.storage': kvProvider(),
  };
}
