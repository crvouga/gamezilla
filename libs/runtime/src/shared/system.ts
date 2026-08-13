import type { Kv } from '@pkgs/kv/interface';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineResource, defineSystem, type Fetch, keyed } from '@pkgs/system';
import type { Driver } from '@pkgs/ui-testing';

import type {
  GoogleAuth,
  LlmProvider,
  Observability,
  PaymentGateway,
  TtsProvider,
} from './ports';

export const db = defineResource<SqlClient>();
export const events = defineResource<PubSub>();

export const room = keyed(
  defineResource<Fetch>()({
    storage: defineResource<Kv>(),
  })
);

export const api = defineResource<Fetch>()({
  db,
  events,
  room,
  kv: defineResource<Kv>(),
  media: defineResource<ObjectStore>(),
  payments: defineResource<PaymentGateway>(),
  tts: defineResource<TtsProvider>(),
  llm: defineResource<LlmProvider>(),
  google: defineResource<GoogleAuth>(),
});

export const client = defineResource<Driver>()({
  db: defineResource<SqlClient>(),
  kv: defineResource<Kv>(),
  observability: defineResource<Observability>(),
  events,
  api,
  room,
});

export const system = defineSystem({
  db,
  events,
  api,
  room,
  client,
});

export type AppSystem = typeof system;
