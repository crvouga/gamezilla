import { userTopic } from '@libs/feature/public/sync';
import {
  friendRequestAcceptedNotifyConsumer,
  friendRequestClosedNotifyConsumer,
  friendRequestSentNotifyConsumer,
} from '@libs/friends/root/server/friends-outbox-consumers';
import { HttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import { drainOutbox, OutboxConsumerRegistry } from '@pkgs/outbox';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { notifyChannels } from '@pkgs/sync-engine/server';
import type { CreateId } from '@pkgs/uuid';
import { apiRequestAsyncLocalStorage } from '../request-scope';

let registry: OutboxConsumerRegistry | null = null;

export function getOutboxConsumerRegistry(): OutboxConsumerRegistry {
  if (registry === null) {
    registry = new OutboxConsumerRegistry();
    registry.register(friendRequestSentNotifyConsumer);
    registry.register(friendRequestAcceptedNotifyConsumer);
    registry.register(friendRequestClosedNotifyConsumer);
    assert.ok(
      registry.all().length > 0,
      'outbox registry must have at least one consumer'
    );
  }
  return registry;
}

/**
 * Drain due outbox deliveries and push notification topics.
 * Publishes synchronously (like mutation fanout) so DST sim timers need not
 * advance for recipients to see rows.
 */
export async function drainAndNotifyOutbox(args: {
  readonly db: SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
}): Promise<number> {
  const result = await drainOutbox({
    db: args.db,
    clock: args.clock,
    createId: args.createId,
    registry: getOutboxConsumerRegistry(),
  });
  if (result.notifyUserIds.length === 0) return result.processed;

  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) {
    return result.processed;
  }
  const topics = result.notifyUserIds
    .filter((id) => id.length > 0)
    .map((id) => userTopic(id));
  if (topics.length === 0) return result.processed;
  const pubsub = await new HttpPubSubFromSecretStore(store.secretStore).get();
  if (pubsub === undefined) {
    return result.processed;
  }
  await notifyChannels({
    pubsub,
    sql: store.sqlClient,
    topics,
    tables: ['notifications'],
    label: 'outbox-drain',
    now: () => store.clock.now(),
  });
  return result.processed;
}
