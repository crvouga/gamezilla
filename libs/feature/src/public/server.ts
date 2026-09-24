/**
 * What a feature contributes to a server: its HTTP routes, the outbox
 * consumers that turn its writes into deliveries, the pubsub topics its rows
 * wake on beyond the actor's own, and the inbox actions it can answer.
 *
 * Kept in its own module because the client half pulls Solid and the design
 * system, and nothing in a Worker should.
 *
 * Every contribution is a function of what the host gives it — a request's
 * SQL client, the clock, id minting — so a feature never reaches for a
 * process singleton and the same feature runs in a Worker, in a Bun process
 * and in a simulation without knowing which.
 */

import type { Clock } from '@pkgs/clock';
import type { OutboxConsumerRegistry } from '@pkgs/outbox';
import type { Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid/create-id';
import type { Hono } from 'hono';

/** What a feature's server half may ask of the host, per request. */
export type FeatureServerCtx = {
  /** The current request's transaction-scoped SQL client. */
  readonly getSqlClient: () => SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
};

/** Who the subscription is for. */
export type PubSubTopicCtx = {
  readonly actorId: string;
  readonly db: SqlClient;
};

/**
 * A feature's sub-app as the host sees it.
 *
 * `Hono` with its default generics: a feature's routes are typed inside the
 * feature, and the host only mounts the app. Surfacing the route schema here
 * would make every feature's endpoints part of the platform's type — and RPC
 * clients read the concrete app type, not this one.
 */
export type FeatureRouter = Hono;

export type FeatureServer = {
  readonly name: string;
  /**
   * Run once when the servers are folded, before anything is mounted: where a
   * feature registers itself with a port another feature published (an inbox
   * action namespace, a webhook kind). Cross-feature wiring that has no
   * request and no tree to hang from lives here, and only features actually
   * composed into this app run it.
   */
  readonly register?: () => void;
  /** Mounted at the API root, in feature order. */
  readonly routes?: (ctx: FeatureServerCtx) => FeatureRouter;
  /**
   * Register this feature's outbox consumers. A registration call rather than
   * a list, because each consumer is typed by its own payload and the
   * registry is what erases that — a list would need `any` to hold them all.
   */
  readonly registerOutbox?: (registry: OutboxConsumerRegistry) => void;
  /**
   * Extra topics this feature's rows reach the actor on — a room, a channel —
   * beyond the actor's own topic, which the platform always grants.
   */
  readonly pubsubTopics?: (ctx: PubSubTopicCtx) => Promise<readonly Topic[]>;
};

export function defineFeatureServer(server: FeatureServer): FeatureServer {
  return server;
}
