import type { AuthProviderModule } from '@pkgs/auth-root-shared-ts/auth-provider-module';
/**
 * What a simulation boots: which bounded contexts, and what each of them needs
 * from the host.
 *
 * The harness is a shell. It knows the fabric — virtual time, the network, the
 * load balancer, the simulated IdP, the SQL engines — and nothing about any
 * sub. A composition names the subs, and the same `composeSubs` /
 * `createClient` / `createServer` folds production runs boot them. A sub's
 * own spec passes its slice; the product passes the flat shipped list. That
 * is what lets a sub's spec live with that sub and stay cached while other
 * subs change.
 */

import type { ClientEnv } from '@libs/app-root-client-ts/client-env';
import type { SubClient } from '@libs/sub-client-ts/client';
import type { ComposedSubs } from '@libs/sub-shared-ts/compose';
import type { RoomGrantsCtx, SubServer } from '@libs/sub-shared-ts/server';
import type { EnvTime } from '@libs/sub-shared-ts/sync';
import type { InhouseAuthProviderOptions } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-provider';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared-ts/offer';
import type { MembershipProviders } from '@pkgs/billing-root-shared-ts/providers';
import type {
  CatalogAction,
  CatalogProperty,
} from '@pkgs/harness-root-shared-ts/effect';
import type {
  RoomStorageTopicReplace,
  RoomStorageTopicSnapshot,
} from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import type { RoomActor, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { Pool } from '@pkgs/sql-client-postgres-shared-ts/pg-types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';

import type { ProductHarness } from './harness';

/** Server-side migrate of a fresh harness Postgres (mockingbird-postgres or embedded). */
export type MigrateHarnessPostgres = (args: {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
  readonly now: () => number;
}) => Promise<void>;

/**
 * The in-process room host a composition runs, if any of its subs uses
 * rooms. Structural, so the harness never names the sub that owns rooms.
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
 * topic's room, decided by the composed subs against the server
 * database (`SubServer.roomGrants`).
 */
export type HarnessRoomGateway = {
  readonly roomGrants: (args: {
    readonly topic: string;
    readonly actor: RoomGrantsCtx['actor'];
  }) => Promise<readonly string[]>;
};

export type HarnessRoomNode = {
  /** A composition may control legal client choices through the injected port. */
  readonly clientRandom?: Random;
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

/**
 * Where the harness's auth service sends emailed sign-in links, built from
 * the service's own environment (its database, clock and ids).
 */
export type HarnessEmailLinks = NonNullable<
  InhouseAuthProviderOptions['emailLinks']
>;

export type HarnessComposition = {
  /** The whole auth service, when a composition configures its own. */
  readonly authProvider?: AuthProviderModule;
  /**
   * Emailed sign-in links for the default auth service. Absent → the service
   * has no email sign-in. Ignored when `authProvider` is set.
   */
  readonly emailLinks?: HarnessEmailLinks;
  /** Names the seed cache and the report; distinct per sub set. */
  readonly name: string;
  /** The folded subs: schema, queries, topic map, mutations. */
  readonly app: ComposedSubs;
  /** Client folds, in mount order (earlier is outermost). */
  readonly clients: readonly SubClient[];
  /** Server folds for one API instance, given the host's services. */
  readonly servers: (deps: {
    readonly billing: MembershipProviders | null;
    readonly rooms: RoomServicePort;
  }) => readonly SubServer[];
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
      setAvailability: absent,
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
