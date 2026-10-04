import type { AuthProviderModule } from '@pkgs/auth-root-shared/auth-provider-module';
/**
 * What a simulation boots: which bounded contexts, and what each of them needs
 * from the host.
 *
 * The harness is a shell. It knows the fabric — virtual time, the network, the
 * load balancer, the simulated IdP, the SQL engines — and nothing about any
 * feature. A composition names the features, and the same `composeFeatures` /
 * `createClient` / `createServer` folds production runs boot them. A feature's
 * own spec passes its slice; the product passes all of it. That is what lets a
 * feature's spec live in the feature and stay cached while other features
 * change.
 */

import type { ClientEnv } from '@libs/app-root-client/client-env';
import type { FeatureClient } from '@libs/feature-client/client';
import type { ComposedFeatures } from '@libs/feature-shared/compose';
import type { FeatureServer, RoomGrantsCtx } from '@libs/feature-shared/server';
import type { EnvTime } from '@libs/feature-shared/sync';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared/offer';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import type {
  CatalogAction,
  CatalogProperty,
} from '@pkgs/harness-root-shared/effect';
import type {
  RoomStorageTopicReplace,
  RoomStorageTopicSnapshot,
} from '@pkgs/room-adapter-memory-shared/room-storage';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import type { RoomActor, RoomState } from '@pkgs/room-root-shared/types';
import type { Pool } from '@pkgs/sql-client-postgres-shared/pg-types';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';

import type { ProductHarness } from './harness';

/** Server-side migrate of a fresh harness Postgres (mockingbird-postgres or embedded). */
export type MigrateHarnessPostgres = (args: {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
  readonly now: () => number;
}) => Promise<void>;

/**
 * The in-process room host a composition runs, if any of its features uses
 * rooms. Structural, so the harness never names the feature that owns rooms.
 */
export type HarnessRoomInspect = {
  readonly topic: string;
  readonly committedState: RoomState;
  readonly roster: readonly RoomActor[];
  readonly storage: RoomStorageTopicSnapshot | null;
};

/**
 * What the API room gateway decides at upgrade, for a room node with no
 * gateway in front of it: the grants the connecting actor holds in the
 * topic's room, decided by the composed features against the server
 * database (`FeatureServer.roomGrants`).
 */
export type HarnessRoomGateway = {
  readonly roomGrants: (args: {
    readonly topic: string;
    readonly actor: RoomGrantsCtx['actor'];
  }) => Promise<readonly string[]>;
};

export type HarnessRoomNode = {
  readonly services: RoomServicePort;
  readonly createTransport: NonNullable<ClientEnv['room']>;
  listTopics(): readonly string[];
  inspect(topic: string): HarnessRoomInspect | null;
  subscribe(listener: () => void): () => void;
  exportTopic(topic: string): RoomStorageTopicSnapshot | null;
  replaceTopic(topic: string, next: RoomStorageTopicReplace): Promise<void>;
  dropTopic(topic: string): void;
  dispose(): void;
};

export type HarnessComposition = {
  readonly authProvider?: AuthProviderModule;
  /** Names the seed cache and the report; distinct per feature set. */
  readonly name: string;
  /** The folded features: schema, queries, topic map, mutations. */
  readonly app: ComposedFeatures;
  /** Client folds, in mount order (earlier is outermost). */
  readonly clients: readonly FeatureClient[];
  /** Server folds for one API instance, given the host's services. */
  readonly servers: (deps: {
    readonly billing: MembershipProviders | null;
    readonly rooms: RoomServicePort;
  }) => readonly FeatureServer[];
  /** Defaults to {@link migrateCompositionPostgres} over `app.schema`. */
  readonly migratePostgres?: MigrateHarnessPostgres;
  /** Folded into the seed fingerprint when `migratePostgres` is custom. */
  readonly migrateFingerprint?: string;
  readonly roomNode?: (
    env: EnvTime,
    gateway: HarnessRoomGateway
  ) => HarnessRoomNode;
  /** Rows every harness of this composition starts with, after migrate. */
  readonly seedServer?: (sqlClient: SqlClient) => Promise<void>;
  /**
   * What the composition sells. When set, the harness runs a payment provider
   * node with this catalog and gives every API instance an adapter to it.
   */
  readonly billingOffer?: PlusMembershipOffer;
  readonly properties?: readonly CatalogProperty<ProductHarness>[];
  readonly actions?: readonly CatalogAction<ProductHarness>[];
};

/** The room node of a composition that runs no rooms: empty, and says so. */
export function noRoomNode(compositionName: string): HarnessRoomNode {
  const absent = (): never => {
    throw new Error(`harness '${compositionName}' composes no room host`);
  };
  return {
    services: {
      read: absent,
      send: absent,
      eraseIdentity: absent,
      disconnect: absent,
    },
    createTransport: () => {
      throw new Error(
        `harness '${compositionName}' composes no room host; add one to its composition`
      );
    },
    listTopics: () => [],
    inspect: () => null,
    subscribe: () => () => undefined,
    exportTopic: () => null,
    replaceTopic: () => Promise.resolve(),
    dropTopic: () => undefined,
    dispose: () => undefined,
  };
}
