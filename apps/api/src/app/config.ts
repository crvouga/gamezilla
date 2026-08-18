import type { Io } from '@pkgs/io';
import type { LlmProvider } from '@pkgs/llm/server';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { Observability } from '@pkgs/observability/port/observability';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SecretStore } from '@pkgs/secret-store';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import type { TtsProvider } from '@pkgs/tts/server';
import type Stripe from 'stripe';

import type { BetterAuthBootConfig } from '../config/better-auth-boot';
import type { OpenRequestDb } from '../db/open-request-db';

export type ApiHandlerConfig = {
  readonly secretStore: SecretStore;
  readonly betterAuth: BetterAuthBootConfig;
  readonly dbScope: PostgresDbScope;
  /** Process-level I/O bag (clock/timers/ids/http). Sims inject createSimIo. */
  readonly io: Io;
  /** When set, overrides secret store `API_URL` for preview / check. */
  readonly apiUrlOverride?: string | null;
  /** When set, overrides secret store `DATABASE_URL` for preview / check. */
  readonly databaseUrlOverride?: string | null;
  /**
   * Per-request DB opener. Worker boots inject Postgres; sims inject SQLite.
   * Required so the Hono graph never default-imports `pg`.
   */
  readonly openRequestDb: OpenRequestDb;
  /**
   * When true, skip non-prod DATABASE_URL policy (sim injects SQLite).
   */
  readonly skipDatabaseUrlPolicy?: boolean;
  /** Secrets env binding (`dev` / `prd`) for database safety checks. */
  readonly secretsEnv: string;
  readonly objectStore: ObjectStore;
  readonly observability: Observability;
  /**
   * When set (including `null`), skips Stripe secret lookup.
   * Non-null mounts configured Stripe routes.
   */
  readonly stripe?: Stripe | null;
  /** When set, mounts a configured LLM app (skips OpenAI secrets). */
  readonly llmProvider?: LlmProvider;
  /** When set, mounts a configured TTS app (skips ElevenLabs secrets). */
  readonly ttsProvider?: TtsProvider;
  /**
   * When set, used for notifyChannels / sync push instead of EMQX HTTP secrets.
   */
  readonly pubSub?: PubSub;
};
