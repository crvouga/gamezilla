/**
 * What a sub contributes to a server: its HTTP routes, the outbox
 * consumers that turn its writes into deliveries, the pubsub topics its rows
 * wake on beyond the actor's own, and the inbox actions it can answer.
 *
 * Kept in its own module because the client half pulls Solid and the design
 * system, and nothing in a Worker should.
 *
 * Every contribution is a function of what the host gives it — a request's
 * SQL client, the clock, id minting — so a sub never reaches for a
 * process singleton and the same sub runs in a Worker, in a Bun process
 * and in a simulation without knowing which.
 */

import type { AuthServerPort } from '@pkgs/auth-root-shared-ts/auth-server-port';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { EventContract } from '@pkgs/observability-root-shared-ts/event-contract';
import type { createEventOutbox } from '@pkgs/observability-root-shared-ts/event-outbox';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { Hono } from 'hono';

/** What a sub's server half may ask of the host, per request. */
export type SubServerCtx = {
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
 * A sub's sub-app as the host sees it.
 *
 * `Hono` with its default generics: a sub's routes are typed inside the
 * sub, and the host only mounts the app. Surfacing the route schema here
 * would make every sub's endpoints part of the platform's type — and RPC
 * clients read the concrete app type, not this one.
 */
export type SubRouter = Hono;

export type SubServer = {
  readonly telemetryEvents?: readonly {
    readonly contract: EventContract;
    readonly outbox: ReturnType<typeof createEventOutbox>;
  }[];
  readonly name: string;
  /** Nested subs of the same kind, folded after this node in listed order. */
  readonly subs?: readonly SubServer[];
  /**
   * Run once when the servers are folded, before anything is mounted: where a
   * sub registers itself with a port another sub published (an inbox
   * action namespace, a webhook kind). Cross-sub wiring that has no
   * request and no tree to hang from lives here, and only subs actually
   * composed into this app run it.
   */
  readonly register?: () => void;
  /** Mounted at the API root, in walk order. */
  readonly routes?: (ctx: SubServerCtx) => SubRouter;
  /**
   * Register this sub's outbox consumers. A registration call rather than
   * a list, because each consumer is typed by its own payload and the
   * registry is what erases that — a list would need `any` to hold them all.
   */
  readonly registerOutbox?: (registry: OutboxConsumerRegistry) => void;
  /**
   * Extra topics this sub's rows reach the actor on — a room, a channel —
   * beyond the actor's own topic, which the platform always grants.
   */
  readonly pubsubTopics?: (ctx: PubSubTopicCtx) => Promise<readonly Topic[]>;
  /**
   * What the connecting actor may do in a live room this sub owns —
   * permission keys the sub decided through `@libs/permissions` — handed
   * to the room with the connection. Empty for topics it does not own.
   */
  readonly roomGrants?: (ctx: RoomGrantsCtx) => Promise<readonly string[]>;
  /**
   * A server-only check of a replayed mutation that needs what only this
   * sub's server half holds (a room it reads), run in the replay
   * transaction before the body. Throws a `MutationError` to refuse.
   */
  readonly authorizeMutation?: MutationAuthorize;
  /** Additional server-owned session constraints, checked on every authenticated request. */
  readonly authorizeSession?: (ctx: SessionAdmissionCtx) => Promise<void>;
};

export function defineSubServer(server: SubServer): SubServer {
  return server;
}
