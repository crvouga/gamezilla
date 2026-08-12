/**
 * In-process API composition for UI / product sims.
 *
 * Wires the usual in-memory fakes (object store, observability, Stripe, LLM,
 * TTS, publish-only pubsub) plus a record secret store and Better Auth boot
 * config. Production / Worker boot stays on {@link createApiApp}.
 */

import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { createInMemoryStripe } from '@libs/stripe/in-memory-stripe';
import type { Io } from '@pkgs/io';
import { InMemoryLlmProvider } from '@pkgs/llm/server';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import {
  createInMemoryPublishOnlyPubSub,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import { InMemoryTtsProvider } from '@pkgs/tts/server';

import { loadBetterAuthBootConfig } from '../config/better-auth-boot';
import type { OpenRequestDb } from '../db/open-request-db';
import { createApiApp } from './create-app';

export type CreateSimApiAppArgs = {
  readonly io: Io;
  readonly openRequestDb: OpenRequestDb;
  /** Shared in-memory bus; API publishes, actors subscribe via peers. */
  readonly pubSubBus: InMemoryBus;
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
    objectStore: new ObjectStoreImplInMemory(),
    observability: createNoopObservability('sim-api'),
    stripe: createInMemoryStripe({ baseUrl: args.apiUrl }),
    llmProvider: new InMemoryLlmProvider(),
    ttsProvider: new InMemoryTtsProvider(),
    pubSub: createInMemoryPublishOnlyPubSub(args.pubSubBus),
  });
}
