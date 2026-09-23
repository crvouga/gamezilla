/**
 * What a simulation boots: which bounded contexts, and what each of them needs
 * from the host.
 *
 * The harness is a shell. It knows the fabric — virtual time, the network, the
 * load balancer, the simulated IdP, the SQL engines — and nothing about any
 * feature. A composition names the features, and the same `composeFeatures` /
 * `createClient` / `createServer` folds production runs boot them. A feature's
 * own e2e passes its slice; the product passes all of it. That is what lets a
 * feature's e2e live in the feature and stay cached while other features
 * change.
 */

import type { ClientEnv, ServerHttp } from '@libs/client-app/shell/client-env';
import type { FeatureClient } from '@libs/feature/public/client';
import type { ComposedFeatures } from '@libs/feature/public/compose';
import type { FeatureServer } from '@libs/feature/public/server';
import type { EnvTime } from '@libs/feature/public/sync';
import type { MembershipProviders, PlusMembershipOffer } from '@pkgs/billing';
import type { RoomActor, RoomState } from '@pkgs/room';
import type {
  RoomStorageTopicReplace,
  RoomStorageTopicSnapshot,
} from '@pkgs/room-adapter-memory';
import type { CatalogAction, CatalogProperty } from '@pkgs/sim';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from '@pkgs/sql-client-postgres/pg-types';
import type { JSX } from 'solid-js';

import type { ProductSim } from './system/sim';

/** Server-side migrate of a fresh sim Postgres (postgres-mem or embedded). */
export type MigrateSimPostgres = (args: {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
  readonly now: () => number;
}) => Promise<void>;

/**
 * The in-process room host a composition runs, if any of its features uses
 * rooms. Structural, so the harness never names the feature that owns rooms.
 */
export type SimRoomInspect = {
  readonly topic: string;
  readonly committedState: RoomState;
  readonly roster: readonly RoomActor[];
  readonly storage: RoomStorageTopicSnapshot | null;
};

export type SimRoomNode = {
  readonly createTransport: NonNullable<ClientEnv['room']>;
  listTopics(): readonly string[];
  inspect(topic: string): SimRoomInspect | null;
  subscribe(listener: () => void): () => void;
  exportTopic(topic: string): RoomStorageTopicSnapshot | null;
  replaceTopic(topic: string, next: RoomStorageTopicReplace): Promise<void>;
  dropTopic(topic: string): void;
  dispose(): void;
};

/** A page a feature serves into the actor's web browser (a hosted checkout). */
export type SimBrowserAppPage = {
  readonly name: string;
  /** Whether this page renders the URL. */
  readonly matches: (url: URL) => boolean;
  /** Stylesheet for the isolated (shadow-root) rendering in a live document. */
  readonly css: string;
  readonly render: (props: {
    readonly url: string;
    readonly fetch: ServerHttp;
    readonly navigate: (url: string) => void;
  }) => JSX.Element;
};

export type SimComposition = {
  /** Names the seed cache and the report; distinct per feature set. */
  readonly name: string;
  /** The folded features: schema, queries, topic map, mutations. */
  readonly app: ComposedFeatures;
  /** Client folds, in mount order (earlier is outermost). */
  readonly clients: readonly FeatureClient[];
  /** Server folds for one API instance, given the host's services. */
  readonly servers: (deps: {
    readonly billing: MembershipProviders | null;
  }) => readonly FeatureServer[];
  /** Defaults to {@link migrateCompositionPostgres} over `app.schema`. */
  readonly migratePostgres?: MigrateSimPostgres;
  /** Folded into the seed fingerprint when `migratePostgres` is custom. */
  readonly migrateFingerprint?: string;
  readonly roomNode?: (env: EnvTime) => SimRoomNode;
  /** Rows every sim of this composition starts with, after migrate. */
  readonly seedServer?: (sqlClient: SqlClient) => Promise<void>;
  readonly browserPages?: readonly SimBrowserAppPage[];
  /**
   * What the composition sells. When set, the sim runs a payment provider
   * node with this catalog and gives every API instance an adapter to it.
   */
  readonly billingOffer?: PlusMembershipOffer;
  readonly properties?: readonly CatalogProperty<ProductSim>[];
  readonly actions?: readonly CatalogAction<ProductSim>[];
};

/** The room node of a composition that runs no rooms: empty, and says so. */
export function noRoomNode(compositionName: string): SimRoomNode {
  return {
    createTransport: () => {
      throw new Error(
        `sim '${compositionName}' composes no room host; add one to its composition`
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
