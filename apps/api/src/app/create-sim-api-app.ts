/**
 * In-process API composition for UI / product sims.
 *
 * Leaves (object store, Stripe, LLM, TTS, pubsub) come from the system graph.
 * Production / Worker boot stays on {@link createApiApp}.
 */

import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import type { Io } from '@pkgs/io';
import type { LlmProvider } from '@pkgs/llm/server';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import type { PubSub } from '@pkgs/pubsub/interface';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { TtsProvider } from '@pkgs/tts/server';
import type Stripe from 'stripe';

import { loadBetterAuthBootConfig } from '../config/better-auth-boot';
import type { OpenRequestDb } from '../db/open-request-db';
import { createApiApp } from './create-app';

export type CreateSimApiAppArgs = {
  readonly io: Io;
  readonly openRequestDb: OpenRequestDb;
  readonly sqlClient: SqlClient;
  readonly pubSub: PubSub;
  readonly objectStore: ObjectStore;
  readonly stripe: Stripe;
  readonly llmProvider: LlmProvider;
  readonly ttsProvider: TtsProvider;
  readonly betterAuthSecret: string;
  readonly databaseUrl: string;
  readonly apiUrl: string;
};

/**
 * Builds a Hono API app suitable for in-process UI sims.
 */
export async function createSimApiApp(
  args: CreateSimApiAppArgs
): Promise<Awaited<ReturnType<typeof createApiApp>>> {
  void args.sqlClient;
  const secretStore = createRecordSecretStore({
    BETTER_AUTH_SECRET: args.betterAuthSecret,
    DATABASE_URL: args.databaseUrl,
    API_URL: args.apiUrl,
  });
  const betterAuth = await loadBetterAuthBootConfig({
    secretStore,
    apiUrlOverride: args.apiUrl,
    secretsEnv: 'dev',
  });
  return createApiApp({
    io: args.io,
    secretStore,
    betterAuth,
    dbScope: appPostgresDbScope(),
    databaseUrlOverride: args.databaseUrl,
    apiUrlOverride: args.apiUrl,
    openRequestDb: args.openRequestDb,
    secretsEnv: 'dev',
    objectStore: args.objectStore,
    observability: createNoopObservability('sim-api'),
    stripe: args.stripe,
    llmProvider: args.llmProvider,
    ttsProvider: args.ttsProvider,
    pubSub: args.pubSub,
  });
}
