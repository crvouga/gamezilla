import { userTopic } from '@libs/db/shared/sync-topics';
import {
  friendRequestAcceptedNotifyConsumer,
  friendRequestClosedNotifyConsumer,
  friendRequestSentNotifyConsumer,
} from '@libs/friends/server/friends-outbox-consumers';
import { assert } from '@pkgs/assert';
import type { Io } from '@pkgs/io';
import { drainOutbox, OutboxConsumerRegistry } from '@pkgs/outbox';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { notifyChannels } from '@pkgs/sync-engine/server';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { getApiPubSub } from './api-pubsub';

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
  readonly io: Io;
}): Promise<number> {
  const result = await drainOutbox({
    db: args.db,
    io: args.io,
    registry: getOutboxConsumerRegistry(),
  });
  if (result.notifyUserIds.length === 0) return result.processed;

  const store = apiRequestAsyncLocalStorage.getStore();
  if (store === undefined) return result.processed;
  const topics = result.notifyUserIds
    .filter((id) => id.length > 0)
    .map((id) => userTopic(id));
  if (topics.length === 0) return result.processed;
  const pubsub = await getApiPubSub(store.secretStore);
  if (pubsub === undefined) return result.processed;
  await notifyChannels({
    pubsub,
    sql: store.sqlClient,
    topics,
    tables: ['notifications'],
    label: 'outbox-drain',
  });
  return result.processed;
}
