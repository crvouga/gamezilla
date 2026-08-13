/**
 * DST `provide` map — keys mirror prod {@link ../server/environment.ts}.
 * Uses real `@pkgs/*` adapters wrapped with {@link decoratePort}.
 */

import { Database } from 'bun:sqlite';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { Kv } from '@pkgs/kv/interface';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { PubSub } from '@pkgs/pubsub/interface';
import {
  createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub/testing/in-memory';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { decoratePort, type ProviderSpec, stubPort } from '@pkgs/system';

import type {
  GoogleAuth,
  LlmProvider,
  Observability,
  PaymentGateway,
  TtsProvider,
} from '../shared/ports';

function bunSqliteProvider(): ProviderSpec<SqlClient> {
  const dbs = new Map<string, Database>();
  return decoratePort<SqlClient>(
    (address) => {
      let raw = dbs.get(address);
      if (!raw) {
        raw = new Database(':memory:');
        raw.run(
          'create table if not exists _dst_ping (id integer primary key)'
        );
        dbs.set(address, raw);
      }
      return new SqlClientImplBunSqlite(raw);
    },
    {
      wipe(_instance, address) {
        const raw = dbs.get(address);
        raw?.run('delete from _dst_ping');
      },
    }
  );
}

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

function busProvider(): ProviderSpec<PubSub> {
  const buses = new Map<string, ReturnType<typeof createInMemoryBus>>();
  return decoratePort<PubSub>((address) => {
    let bus = buses.get(address);
    if (!bus) {
      bus = createInMemoryBus();
      buses.set(address, bus);
    }
    return createInMemoryPubSub({ bus });
  });
}

const payments: PaymentGateway = {
  async charge(cents, currency) {
    return { id: `pay_${cents}_${currency}` };
  },
};

const tts: TtsProvider = {
  async synthesize(text) {
    return new TextEncoder().encode(`tts:${text}`);
  },
};

const llm: LlmProvider = {
  async complete(prompt) {
    return `echo:${prompt}`;
  },
};

const google: GoogleAuth = {
  async getAuthUrl(state) {
    return `https://accounts.google.com/o/oauth2?state=${state}`;
  },
};

const sentry: Observability = {
  captureException() {},
  captureMessage() {},
};

/** DST `provide` map — keys mirror prod {@link ../server/environment.ts}. */
export const dstProvide: Record<string, ProviderSpec> = {
  db: bunSqliteProvider(),
  events: busProvider(),
  'api.kv': kvProvider(),
  'api.media': blobProvider(),
  'api.payments': stubPort(payments),
  'api.tts': stubPort(tts),
  'api.llm': stubPort(llm),
  'api.google': stubPort(google),
  'client.db': bunSqliteProvider(),
  'client.kv': kvProvider(),
  'client.sentry': stubPort(sentry),
  'room.storage': kvProvider(),
  'room:*.storage': kvProvider(),
};
