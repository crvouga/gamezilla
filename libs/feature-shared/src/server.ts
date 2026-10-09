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

import type { Clock } from '@pkgs/clock-shared/types';
import type { AuthServerPort } from '@pkgs/auth-root-shared/auth-server-port';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared/mutations-types';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import type { Hono } from 'hono';

/** What a feature's server half may ask of the host, per request. */
export type FeatureServerCtx = {
  /** The current request's transaction-scoped SQL client. */
  readonly getSqlClient: () => SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly authServer: AuthServerPort;
};

/** Who the subscription is for. */
export type PubSubTopicCtx = {
  readonly actorId: string;
  readonly db: SqlClient;
};

/**
 * Who is opening a live room connection, as the room gateway resolved them
 * at upgrade: the room identity (`accountId ?? deviceId`), the install, and
 * the account when the bearer resolved one.
 */
export type RoomGrantsCtx = {
  readonly db: SqlClient;
  readonly topic: string;
  readonly actor: {
    readonly memberId: string;
    readonly deviceId: string;
    readonly accountId: string | null;
  };
  readonly nowMs: number;
};

export type SessionAdmissionCtx = {
  readonly db: SqlClient;
  readonly accountId: string | null;
  readonly deviceId: string;
  readonly nowMs: number;
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
  /**
   * What the connecting actor may do in a live room this feature owns —
   * permission keys the feature decided through `@libs/permissions` — handed
   * to the room with the connection. Empty for topics it does not own.
   */
  readonly roomGrants?: (ctx: RoomGrantsCtx) => Promise<readonly string[]>;
  /**
   * A server-only check of a replayed mutation that needs what only this
   * feature's server half holds (a room it reads), run in the replay
   * transaction before the body. Throws a `MutationError` to refuse.
   */
  readonly authorizeMutation?: MutationAuthorize;
  /** Additional server-owned session constraints, checked on every authenticated request. */
  readonly authorizeSession?: (ctx: SessionAdmissionCtx) => Promise<void>;
};

export function defineFeatureServer(server: FeatureServer): FeatureServer {
  return server;
}
