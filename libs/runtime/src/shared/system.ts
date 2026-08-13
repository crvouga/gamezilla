import type { Kv } from '@pkgs/kv/interface';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineSystem, type Fetch, keyed, resource } from '@pkgs/system';
import type { Driver } from '@pkgs/ui-testing';

import type {
  GoogleAuth,
  LlmProvider,
  Observability,
  PaymentGateway,
  TtsProvider,
} from './ports';

export const db = resource<SqlClient>();
export const events = resource<PubSub>();

export const room = keyed(
  resource<Fetch>()({
    storage: resource<Kv>(),
  })
);

export const api = resource<Fetch>()({
  db,
  events,
  room,
  kv: resource<Kv>(),
  media: resource<ObjectStore>(),
  payments: resource<PaymentGateway>(),
  tts: resource<TtsProvider>(),
  llm: resource<LlmProvider>(),
  google: resource<GoogleAuth>(),
});

/** Client spawn facade is the UI-testing {@link Driver}. */
export const client = resource<Driver>()({
  db: resource<SqlClient>(),
  kv: resource<Kv>(),
  events,
  api,
  room,
  sentry: resource<Observability>(),
});

export const system = defineSystem({
  db,
  events,
  api,
  room,
  client,
});

export type AppSystem = typeof system;
