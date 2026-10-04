import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared/request-scope';
import { accountMutationEnv } from '@libs/auth-shared/account-mutation-env';
import { userTopic } from '@libs/feature-shared/sync';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server/create-http-pubsub-from-secret-store';
import { assert } from '@pkgs/assert-root-shared/singleton';
import type { Clock } from '@pkgs/clock-shared/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import { drainOutbox } from '@pkgs/outbox-shared/drain';
import type { PubSub } from '@pkgs/pubsub-root-shared/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

let registry: OutboxConsumerRegistry | null = null;

/**
 * The consumers the composed features registered. Set once while the server
 * is built, because a delivery can be drained from any request and the
 * request has no idea which features this app runs.
 */
export function setOutboxConsumerRegistry(next: OutboxConsumerRegistry): void {
  registry = next;
}

export function getOutboxConsumerRegistry(): OutboxConsumerRegistry {
  assert.defined(
    registry,
    'outbox registry: not composed — createServer sets it from the feature fold'
  );
  return registry;
}

/**
 * Drain due outbox deliveries and push notification topics.
 * Publishes synchronously (like mutation fanout) so DST harness timers need not
 * advance for recipients to see rows.
 */
export async function drainAndNotifyOutbox(args: {
  readonly db: SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly pubsub?: PubSub | null;
  readonly objectStore: ObjectStore;
  readonly consumerRegistry?: OutboxConsumerRegistry;
  readonly eventIds?: readonly string[];
}): Promise<number> {
  const captures: ReturnType<typeof wrapMutationDb>[] = [];
  const result = await drainOutbox({
    db: args.db,
    clock: args.clock,
    createId: args.createId,
    registry: args.consumerRegistry ?? getOutboxConsumerRegistry(),
    objectStore: args.objectStore,
    ...(args.eventIds === undefined ? {} : { eventIds: args.eventIds }),
    wrapConsumerTx: (tx) => {
      const wrapped = wrapMutationDb(tx, accountMutationEnv('', args));
      captures.push(wrapped);
      return wrapped.tx;
    },
  });
  if (result.notifyUserIds.length === 0) return result.processed;

  const store = apiRequestAsyncLocalStorage.getStore();
  const topics = result.notifyUserIds
    .filter((id) => id.length > 0)
    .map((id) => userTopic(id));
  if (topics.length === 0) return result.processed;
  const pubsub =
    args.pubsub ??
    (store === undefined
      ? undefined
      : await new HttpPubSubFromSecretStore(
          store.secretStore,
          args.clock.now
        ).get());
  if (pubsub == null) {
    return result.processed;
  }
  await notifyChannels({
    pubsub,
    sql: args.db,
    topics,
    tables: [
      ...new Set(captures.flatMap((capture) => capture.getCapture().tables)),
    ].sort(),
    label: 'outbox-drain',
    now: args.clock.now,
  });
  return result.processed;
}
