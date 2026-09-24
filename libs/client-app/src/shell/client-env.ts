/**
 * Solid / web `ClientEnv` — every nondeterministic or platform port the
 * product client needs, injected once by `createClient(env)`.
 *
 * Mirrors the RN `product/client-env.ts` minus the native-only `gestureRoot`
 * and `bottomSheetHost` (the web bottom sheet is the `@pkgs/ui` default).
 */

import type { DevMenuPort } from '@libs/client-app/device/ports';
import type { OpenSqlClient, ServerHttp } from '@libs/feature/public/sync';
import type { AuthClientPort } from '@pkgs/auth/client';
import type { Clock, Timers } from '@pkgs/clock';
import type { ClipboardPort } from '@pkgs/device/clipboard';
import type { HapticsPort } from '@pkgs/device/haptics';
import type { NetworkStatePort } from '@pkgs/device/network-state';
import type { Kv } from '@pkgs/kv/interface';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { ClientTransport } from '@pkgs/room';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import type { AudioPlaybackPort } from '@pkgs/sounds/audio-playback/ports';
import type { OpenExternalUrl } from '@pkgs/ui';
import type { CreateId, Random } from '@pkgs/uuid/create-id';

export type { ServerHttp };

/**
 * Room WebSocket transport factory. Mirrors
 * `@libs/spaces` `CreateRoomTransport`; declared locally because the spaces
 * factory module still carries context helpers.
 */
export type CreateRoomTransportArgs = {
  readonly spaceId: string;
  readonly apiUrl: string;
  /** Member actor id (`accountId ?? deviceId`) — room identity + roster. */
  readonly identity: string;
  readonly installId: string;
  readonly clientId: string;
  readonly getSessionToken: () => string | null | Promise<string | null>;
  readonly timers: Timers;
  readonly random: Random;
};

export type CreateRoomTransport = (
  args: CreateRoomTransportArgs
) => ClientTransport;

/** Web / test {@link DevMenuPort}: the command palette is the dev entry point. */
export function createNoopDevMenuPort(): DevMenuPort {
  return { registerItems: () => Promise.resolve() };
}

export type ClientEnv = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly random: Random;
  readonly seed: bigint;
  readonly server: ServerHttp;
  readonly events: PubSub;
  /**
   * Mint a fresh PubSub for sync push. Remake closes the previous instance —
   * must not return a closed singleton (see attachPush remake contract).
   * Sim injects its shared in-memory bus. Wall omits it: push then uses the
   * EMQX broker from synced `client_config`.
   */
  readonly createPubSub?: () => PubSub;
  readonly openSqlClient: OpenSqlClient;
  /** Sim may shorten the sync safety-net interval. Wall uses the engine default. */
  readonly reconcileIntervalMs?: number;
  readonly kv: Kv;
  readonly secureStorage: SecureStorageStore;
  readonly room: CreateRoomTransport;
  readonly network: NetworkStatePort;
  /** System clipboard write (copy device id, avatar seed, …). */
  readonly clipboard: ClipboardPort;
  /** Haptic feedback (puzzle solved / wrong move, …). */
  readonly haptics: HapticsPort;
  readonly audio: AudioPlaybackPort;
  readonly devMenu: DevMenuPort;
  /**
   * Local blob cache (TTS audio, …). Web addition vs the RN env, which built
   * a file-system store inside its services provider: the browser store
   * (OPFS / Cache API) is a wall adapter, so the composition root injects it.
   */
  readonly objectStore: ObjectStore;
  readonly serverUrl: string;
  /**
   * The auth service's client adapter, built fresh for each app tree. The
   * composition root picks the service and owns how it is reached (its
   * token storage, its sign-in window, its callback URL); the app only ever
   * holds the `@pkgs/auth` port.
   */
  readonly createAuthClient: () => AuthClientPort;
  /**
   * Leaves the app for a provider-hosted page (the payment provider's
   * checkout or portal). Browser: `location.assign`; sim: the provider's real screens,
   * walked headlessly.
   */
  readonly openExternalUrl: OpenExternalUrl;
  /** Sync-engine pool key / local DB name (sim: per-actor; prod: per-user). */
  readonly resolveDatabaseName: (args: { readonly userId: string }) => string;
  /**
   * Default success-face hold (ms) for mutation buttons when the call site
   * omits `successHoldMs`. Wall and sim: 900 (ClientEnvProvider projects this).
   */
  readonly mutationSuccessHoldMs: number;
};
