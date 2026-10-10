/**
 * The server half of the fold: a set of {@link SubServer}s becomes one
 * list of routers to mount, one set of outbox consumers, and one topic
 * projection.
 *
 * Same shape as the other two folds, and used the same way — the API mounts
 * every sub, a subsystem harness mounts the one under test, and neither
 * knows which it is. A node is ordered before the subs it contains.
 */

import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared/mutations-types';

import { flattenSubs } from './flatten';
import type {
  PubSubTopicCtx,
  RoomGrantsCtx,
  SessionAdmissionCtx,
  SubRouter,
  SubServer,
  SubServerCtx,
} from './server';

export type ComposedSubServers = {
  readonly subNames: readonly string[];
  /** Sub-apps to mount at the API root, in walk order. */
  readonly routers: (ctx: SubServerCtx) => readonly SubRouter[];
  /** Every composed sub's consumers, registered once. */
  readonly outboxConsumers: OutboxConsumerRegistry;
  /** Every topic the composed subs grant this actor, deduped and sorted. */
  readonly pubsubTopics: (ctx: PubSubTopicCtx) => Promise<readonly Topic[]>;
  /** Every grant the composed subs give the actor in a room, sorted. */
  readonly roomGrants: (ctx: RoomGrantsCtx) => Promise<readonly string[]>;
  /** Every composed sub's server-only mutation check, in walk order. */
  readonly authorizeMutation: MutationAuthorize;
  readonly authorizeSession: (ctx: SessionAdmissionCtx) => Promise<void>;
};

/**
 * Every grant `servers` give the actor in a room, deduped and sorted — the
 * room gateway's one question, answerable without mounting anything.
 */
export function composeRoomGrants(
  servers: readonly SubServer[]
): (ctx: RoomGrantsCtx) => Promise<readonly string[]> {
  const subs = flattenSubs(servers, 'composeRoomGrants');
  return async (ctx) => {
    const granted = await Promise.all(
      subs.map(async (s) => (s.roomGrants ? await s.roomGrants(ctx) : []))
    );
    return [...new Set(granted.flat())].sort();
  };
}

export function composeSubServers(
  servers: readonly SubServer[]
): ComposedSubServers {
  const subs = flattenSubs(servers, 'composeSubServers');
  for (const server of subs) server.register?.();
  // The registry itself rejects duplicate ids, so two subs claiming the
  // same consumer fails here rather than at the first delivery.
  const outboxConsumers = new OutboxConsumerRegistry();
  for (const server of subs) server.registerOutbox?.(outboxConsumers);
  return {
    subNames: subs.map((s) => s.name),
    routers: (ctx) => subs.flatMap((s) => (s.routes ? [s.routes(ctx)] : [])),
    outboxConsumers,
    pubsubTopics: async (ctx) => {
      const granted = await Promise.all(
        subs.map(async (s) => (s.pubsubTopics ? await s.pubsubTopics(ctx) : []))
      );
      // Sorted so an ACL is a function of the actor, not of walk order.
      return [...new Set(granted.flat())].sort();
    },
    // Roots, not the flat list: nodes keep their `subs`, and this walk is its own.
    roomGrants: composeRoomGrants(servers),
    authorizeMutation: async (ctx) => {
      for (const server of subs) await server.authorizeMutation?.(ctx);
    },
    authorizeSession: async (ctx) => {
      for (const server of subs) await server.authorizeSession?.(ctx);
    },
  };
}
