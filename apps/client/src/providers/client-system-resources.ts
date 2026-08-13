/**
 * Optional client resource bag for {@link SystemProvider}.
 * Every field is optional; when omitted providers build production defaults.
 * Sims pass the full bag from `client.implement`.
 */

import type { AuthClientStorage } from '@pkgs/auth-better-auth/client';
import type { Kv } from '@pkgs/kv/interface';
import type { Observability } from '@pkgs/observability/port/observability';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import type { AudioPlaybackPort } from '@pkgs/sounds/audio-playback/ports';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { useSystemResources } from '@pkgs/system/react';

import type { DevMenuPort, NetworkStatePort } from '../device/ports';
import type { OpenLocalSqlClient } from '../sync/create-local-sync-engine';
import type { AppSyncEnginePool } from '../sync/sync-engine-pool';

export type ClientSystemResources = {
  /** API base URL for config / auth (default `EXPO_PUBLIC_API_URL`). */
  readonly apiUrl?: string;
  /** Better Auth base URL (default `EXPO_PUBLIC_API_URL`). */
  readonly authBaseURL?: string;
  readonly authClientStorage?: AuthClientStorage;
  readonly secureStorageStore?: SecureStorageStore;
  readonly openSqlClient?: OpenLocalSqlClient;
  readonly syncEnginePool?: AppSyncEnginePool;
  readonly createPubSub?: () => PubSub;
  readonly kv?: Kv;
  readonly network?: NetworkStatePort;
  readonly devMenu?: DevMenuPort;
  readonly audio?: AudioPlaybackPort;
  /** Graph-resolved client.db when provided by DST. */
  readonly db?: SqlClient;
  /** Graph-resolved client.observability when provided by DST. */
  readonly observability?: Observability;
};

export function useClientSystemResources(): ClientSystemResources {
  return useSystemResources<ClientSystemResources>();
}
