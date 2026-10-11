/**
 * The sync vocabulary the platform fixes for every app it composes: how a
 * client opens its identity-scoped database, and the topic a person's own
 * rows wake on.
 *
 * These are not a sub's to choose. A sub declares which of its tables
 * wake on which topics; that every actor has a `user:<id>` topic, and that
 * unscoped rows enter through it, is the shell's arrangement — which is why
 * the shell can build a sync engine without knowing what was composed into
 * it.
 */

import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';

/**
 * Opens a SQL client. A client's is identity-scoped (`userId` /
 * `databaseName`); a server's closes over connection details and ignores the
 * arguments.
 */
export type OpenSqlClient = (args?: {
  readonly userId?: string;
  readonly databaseName?: string;
}) => Promise<SqlClient>;

/**
 * The time and entropy every composition root injects — client, server and
 * room alike. Nothing downstream may reach for a wall clock or a global RNG.
 */
export type EnvTime = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly random: () => number;
  readonly seed: bigint;
};

/**
 * HTTP to this app's server, and nothing else. Not a general-purpose fetch:
 * a client gets one of these and can reach the API, not the internet.
 */
export type ServerHttp = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Who the push is for. */
export type ChannelsCtx = {
  readonly actorId: string;
};

/** Every actor's own topic. */
export function userTopic(actorId: string): Topic {
  return `user:${actorId}`;
}

export function userChannels(ctx: ChannelsCtx): Topic[] {
  return [userTopic(ctx.actorId)];
}

/**
 * Entry wake for a query that does not name its own. Rows not yet in scope
 * reach a client through the actor's topic.
 */
export function defaultEntryChannel(
  _params: unknown,
  ctx: ChannelsCtx
): Topic[] {
  return [userTopic(ctx.actorId)];
}
