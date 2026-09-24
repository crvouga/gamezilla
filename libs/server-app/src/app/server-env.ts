import type { OpenSqlClient } from '@libs/feature/public/sync';
import type { AuthProviderModule } from '@pkgs/auth/server';
import type { MembershipProviders } from '@pkgs/billing';
import type { Clock, Timers } from '@pkgs/clock';
import type { Kv } from '@pkgs/kv/interface';
import type { LlmProvider } from '@pkgs/llm/server';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SecretStore } from '@pkgs/secret-store';
import type { TtsProvider } from '@pkgs/tts/server';

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
  /**
   * The auth service, as a module this server builds from `secrets`. The
   * server never learns which service it is.
   */
  readonly auth: AuthProviderModule;
  readonly secretsEnv: string;
  readonly serverUrl: string | null;
  /** Exact OTLP/HTTP traces endpoint used by the browser ingress proxy. */
  readonly observabilityCollectorUrl?: string | null;
  /** Write-only OTLP ingest credential; never exposed to the browser. */
  readonly observabilityCollectorToken?: string | null;
  /** Basic-auth user for OTLP ingest (Grafana Cloud stack id); null → Bearer. */
  readonly observabilityCollectorUser?: string | null;
  readonly skipDatabaseUrlPolicy: boolean;
  /** Vendor HTTP (OpenAI / ElevenLabs). Not ClientEnv.server. */
  readonly fetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
};
