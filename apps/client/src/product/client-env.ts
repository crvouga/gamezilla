import type { DevMenuPort, NetworkStatePort } from '@apps/client/device/ports';
import type { OpenSqlClient } from '@libs/runtime/shared/env';
import type { CreateRoomTransport } from '@libs/spaces/root/client/room/room-transport-factory';
import type { AuthClientStorage } from '@pkgs/auth-better-auth/client';
import type { Clock, Timers } from '@pkgs/clock';
import type { Kv } from '@pkgs/kv/interface';
import type { Observability } from '@pkgs/observability/port/observability';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import type { AudioPlaybackPort } from '@pkgs/sounds/audio-playback/ports';

/** HTTP to the server app only — not a generic fetch. */
export type ServerHttp = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type ClientEnv = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly random: () => number;
  readonly seed: bigint;
  readonly server: ServerHttp;
  readonly events: PubSub;
  readonly openSqlClient: OpenSqlClient;
  readonly kv: Kv;
  readonly authStorage: AuthClientStorage;
  readonly secureStorage: SecureStorageStore;
  readonly room: CreateRoomTransport;
  readonly network: NetworkStatePort;
  readonly audio: AudioPlaybackPort;
  readonly devMenu: DevMenuPort;
  readonly observability: Observability;
  readonly serverUrl: string;
  readonly authBaseURL: string;
  /** Sync-engine pool key / local DB name (sim: per-actor; prod: per-user). */
  readonly resolveDatabaseName: (args: { readonly userId: string }) => string;
};
