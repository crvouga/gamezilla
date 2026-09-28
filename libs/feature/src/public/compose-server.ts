/**
 * The server half of the fold: a set of {@link FeatureServer}s becomes one
 * list of routers to mount, one set of outbox consumers, and one topic
 * projection.
 *
 * Same shape as the other two folds, and used the same way — the API mounts
 * every feature, a subsystem harness mounts the one under test, and neither
 * knows which it is.
 */

import { assert } from '@pkgs/assert';
import { OutboxConsumerRegistry } from '@pkgs/outbox';
import type { Topic } from '@pkgs/pubsub/interface';

import type {
  FeatureRouter,
  FeatureServer,
  FeatureServerCtx,
  PubSubTopicCtx,
  RoomGrantsCtx,
} from './server';

export type ComposedFeatureServers = {
  readonly featureNames: readonly string[];
  /** Sub-apps to mount at the API root, in feature order. */
  readonly routers: (ctx: FeatureServerCtx) => readonly FeatureRouter[];
  /** Every composed feature's consumers, registered once. */
  readonly outboxConsumers: OutboxConsumerRegistry;
  /** Every topic the composed features grant this actor, deduped and sorted. */
  readonly pubsubTopics: (ctx: PubSubTopicCtx) => Promise<readonly Topic[]>;
  /** Every grant the composed features give the actor in a room, sorted. */
  readonly roomGrants: (ctx: RoomGrantsCtx) => Promise<readonly string[]>;
};

/**
 * Every grant `servers` give the actor in a room, deduped and sorted — the
 * room gateway's one question, answerable without mounting anything.
 */
export function composeRoomGrants(
  servers: readonly FeatureServer[]
): (ctx: RoomGrantsCtx) => Promise<readonly string[]> {
  return async (ctx) => {
    const granted = await Promise.all(
      servers.map(async (s) => (s.roomGrants ? await s.roomGrants(ctx) : []))
    );
    return [...new Set(granted.flat())].sort();
  };
}

export function composeFeatureServers(
  servers: readonly FeatureServer[]
): ComposedFeatureServers {
  const names = new Set<string>();
  for (const server of servers) {
    assert.ok(
      !names.has(server.name),
      `composeFeatureServers: duplicate feature '${server.name}'`
    );
    names.add(server.name);
  }
  for (const server of servers) server.register?.();
  // The registry itself rejects duplicate ids, so two features claiming the
  // same consumer fails here rather than at the first delivery.
  const outboxConsumers = new OutboxConsumerRegistry();
  for (const server of servers) server.registerOutbox?.(outboxConsumers);
  return {
    featureNames: servers.map((s) => s.name),
    routers: (ctx) => servers.flatMap((s) => (s.routes ? [s.routes(ctx)] : [])),
    outboxConsumers,
    pubsubTopics: async (ctx) => {
      const granted = await Promise.all(
        servers.map(async (s) =>
          s.pubsubTopics ? await s.pubsubTopics(ctx) : []
        )
      );
      // Sorted so an ACL is a function of the actor, not of feature order.
      return [...new Set(granted.flat())].sort();
    },
    roomGrants: composeRoomGrants(servers),
  };
}
