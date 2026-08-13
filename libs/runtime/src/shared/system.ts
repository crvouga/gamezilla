import type { Kv } from '@pkgs/kv/interface';
import type { LlmProvider } from '@pkgs/llm/shared/llm-provider';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { Observability } from '@pkgs/observability/port/observability';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineSystem, type Fetch, keyed, resource } from '@pkgs/system';
import type { TtsProvider } from '@pkgs/tts/server/ports/tts-provider';
import type Stripe from 'stripe';

/** Client resource handle — prod app or DST Driver both expose dispose. */
export type ClientHandle = {
  close(): Promise<void>;
};

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
  payments: resource<Stripe>(),
  tts: resource<TtsProvider>(),
  llm: resource<LlmProvider>(),
});

export const client = resource<ClientHandle>()({
  db: resource<SqlClient>(),
  kv: resource<Kv>(),
  observability: resource<Observability>(),
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
