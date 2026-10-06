import type { OpenSqlClient } from '@libs/feature-shared/sync';
import type { ModerationRules } from '@libs/moderation-shared/moderation-rules';
import type { AuthProviderModule } from '@pkgs/auth-root-shared/auth-provider-module';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { Kv } from '@pkgs/kv-root-shared/interface';
import type { LlmProvider } from '@pkgs/llm-root-shared/llm-provider';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { PubSub } from '@pkgs/pubsub-root-shared/interface';
import type { SecretStore } from '@pkgs/secret-store-shared/interface';
import type { TtsProvider } from '@pkgs/tts-root-shared/tts-provider';
import type { DeploymentProtection } from './env';

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
  /**
   * The shared spec reports store every environment reads (`/api/reports`);
   * null when this deployment holds no credential for it.
   */
  readonly reports: ObjectStore | null;
  readonly billing: MembershipProviders | null;
  readonly tts: TtsProvider | null;
  readonly llm: LlmProvider | null;
  readonly secrets: SecretStore;
  /**
   * The auth service, as a module this server builds from `secrets`. The
   * server never learns which service it is.
   */
  readonly auth: AuthProviderModule;
  /**
   * The moderation this server runs with: the team's rules as they ship,
   * judging every replayed write by the rules of its time.
   */
  readonly moderation: ModerationRules;
  /**
   * Whether this deployment is production (the env file's `protection`).
   * Production-only behavior branches on this, never on an env name.
   */
  readonly protection: DeploymentProtection;
  /** Account ids allowed to manage this environment's puzzle pool. */
  readonly puzzleManagerAccountIds?: readonly string[];
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
