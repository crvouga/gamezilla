import type { OpenSqlClient } from '@libs/feature/public/sync';
import type { MembershipProviders } from '@pkgs/billing';
import type { Clock, Timers } from '@pkgs/clock';
import type { Kv } from '@pkgs/kv/interface';
import type { LlmProvider } from '@pkgs/llm/server';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { Observability } from '@pkgs/observability/port/observability';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SecretStore } from '@pkgs/secret-store';
import type { TtsProvider } from '@pkgs/tts/server';

import type { AuthBootConfig } from '../config/auth-boot';

export type ServerEnv = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly random: () => number;
  readonly seed: bigint;
  readonly openSqlClient: OpenSqlClient;
  readonly events: PubSub | null;
  readonly kv: Kv | null;
  readonly blob: ObjectStore;
  readonly billing: MembershipProviders | null;
  readonly tts: TtsProvider | null;
  readonly llm: LlmProvider | null;
  readonly secrets: SecretStore;
  readonly observability: Observability;
  readonly auth: AuthBootConfig;
  readonly secretsEnv: string;
  readonly serverUrl: string | null;
  readonly skipDatabaseUrlPolicy: boolean;
  /** Vendor HTTP (OpenAI / ElevenLabs). Not ClientEnv.server. */
  readonly fetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
};
