import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared-ts/request-scope';
import { accountMutationEnv } from '@libs/auth-shared-ts/account-mutation-env';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import { SpanStatusCode } from '@opentelemetry/api';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import {
  drainOutbox,
  type ObserveDelivery,
} from '@pkgs/outbox-shared-ts/drain';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { notifyChannels } from '@pkgs/sync-engine-server-ts/notify-channels';
import {
  type TopicMap,
  topicMapCtxFromEnv,
} from '@pkgs/sync-engine-shared-ts/topic-map';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { countExhaustedOutboxDeliveries } from './outbox-health';
import { outboxNotificationTopics } from './outbox-notification-topics';

/**
 * One span per delivery: a consumer that fails is retried rather than thrown,
 * so without this a failing consumer leaves no trace of which one it was.
 */
const observeOutboxDelivery: ObserveDelivery = (info, run) =>
  withSpan(
    'outbox.deliver',
    async (span) => {
      const result = await run();
      if (!result.ok) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: result.failure ?? 'delivery failed',
        });
      }
      return result;
    },
    {
      [ATTR.APP_OUTBOX_CONSUMER]: info.consumerId,
      [ATTR.APP_OUTBOX_EVENT_TYPE]: info.eventType,
      [ATTR.APP_OUTBOX_EVENT_ID]: info.eventId,
      [ATTR.APP_OUTBOX_ATTEMPT]: info.attempt,
      [ATTR.CODE_FILE_PATH]: 'libs/app-root-server-ts/src/outbox-drain.ts',
      [ATTR.CODE_FUNCTION_NAME]: 'observeOutboxDelivery',
    }
  );

let registry: OutboxConsumerRegistry | null = null;
const topicMaps = new WeakMap<OutboxConsumerRegistry, TopicMap>();

/** Telemetry delivery belongs to the background drain, never gameplay latency. */
export function requestOutboxRegistry(
  all: OutboxConsumerRegistry
): OutboxConsumerRegistry {
  const requests = new OutboxConsumerRegistry();
  requests.registerAll(
    all
      .all()
      .filter(
        (consumer) =>
          consumer.delivery !== 'background' &&
          !consumer.id.startsWith('telemetry:')
      )
  );
  const topicMap = topicMaps.get(all);
  if (topicMap !== undefined) topicMaps.set(requests, topicMap);
  return requests;
}

/**
 * The consumers the composed subs registered. Set once while the server
 * is built, because a delivery can be drained from any request and the
 * request has no idea which subs this app runs.
 */
export function setOutboxConsumerRegistry(
  next: OutboxConsumerRegistry,
  topicMap: TopicMap
): void {
  registry = next;
  topicMaps.set(next, topicMap);
}

export function getOutboxConsumerRegistry(): OutboxConsumerRegistry {
  assert.defined(
    registry,
    'outbox registry: not composed — createServer sets it from the sub fold'
  );
  return registry;
}

type DrainAndNotifyArgs = {
  readonly db: SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly pubsub?: PubSub | null;
  readonly objectStore: ObjectStore;
  readonly consumerRegistry?: OutboxConsumerRegistry;
  readonly eventIds?: readonly string[];
  readonly topicMap?: TopicMap;
  readonly maxPasses?: number;
  readonly limit?: number;
};

/** Drain bounded causal passes, publishing each committed result before the next pass. */
export async function drainAndNotifyOutbox(
  args: DrainAndNotifyArgs
): Promise<number> {
  const consumers = args.consumerRegistry ?? getOutboxConsumerRegistry();
  let processed = 0;
  for (let pass = 0; pass < (args.maxPasses ?? 8); pass++) {
    const captures: ReturnType<typeof wrapMutationDb>[] = [];
    const result = await drainOutbox({
      db: args.db,
      clock: args.clock,
      createId: args.createId,
      registry: consumers,
      objectStore: args.objectStore,
      observeDelivery: observeOutboxDelivery,
      ...(args.limit === undefined ? {} : { limit: args.limit }),
      ...(args.eventIds === undefined ? {} : { eventIds: args.eventIds }),
      wrapConsumerTx: (tx) => {
        const wrapped = wrapMutationDb(tx, accountMutationEnv('', args));
        captures.push(wrapped);
        return wrapped.tx;
      },
    });
    processed += result.processed;
    countExhaustedOutboxDeliveries(result.exhausted);
    // This pass has committed. Publish it before following deliveries can wait.
    await notifyCommittedPass(args, consumers, captures, result.notifyUserIds);
    if (result.processed === 0) break;
  }
  return processed;
}

async function notifyCommittedPass(
  args: DrainAndNotifyArgs,
  consumers: OutboxConsumerRegistry,
  captures: readonly ReturnType<typeof wrapMutationDb>[],
  notifyUserIds: readonly string[]
): Promise<void> {
  const store = apiRequestAsyncLocalStorage.getStore();
  const topics = await outboxNotificationTopics({
    topicMap: args.topicMap ?? topicMaps.get(consumers),
    captures: captures.map((capture) => capture.getCapture()),
    notifyUserIds,
    db: args.db,
    ctx: topicMapCtxFromEnv(
      accountMutationEnv(notifyUserIds[0] ?? 'system', args)
    ),
  });
  if (topics.length === 0) return;
  const pubsub =
    args.pubsub ??
    (store === undefined
      ? undefined
      : await new HttpPubSubFromSecretStore(
          store.secretStore,
          args.clock.now,
          store.http
        ).get());
  if (pubsub == null) {
    return;
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
}
