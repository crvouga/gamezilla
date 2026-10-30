import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared-ts/request-scope';
import { accountMutationEnv } from '@libs/auth-shared-ts/account-mutation-env';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import { SpanStatusCode } from '@opentelemetry/api';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { beginSyncMeasurement } from '@pkgs/observability-root-shared-ts/metric-contract';
import { observeSync, withSpan } from '@pkgs/observability-root-shared-ts/span';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import {
  type DrainOutboxDeps,
  drainOutbox,
  type ObserveDelivery,
} from '@pkgs/outbox-shared-ts/drain';
import { hasDueOutboxWork } from '@pkgs/outbox-shared-ts/due-work';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { notifyChannels } from '@pkgs/sync-engine-server-ts/notify-channels';
import {
  type TopicMap,
  topicMapCtxFromEnv,
} from '@pkgs/sync-engine-shared-ts/topic-map';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import {
  capturedOutboxScope,
  consumersForEvents,
  extendEventTypes,
} from './outbox-event-scope';
import {
  countExhaustedOutboxDeliveries,
  observeOutboxReadyAge,
} from './outbox-health';
import { outboxNotificationPlan } from './outbox-notification-plan';

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
  /** Durable authenticated mutation families, including pending descendants. */
  readonly causationIds?: readonly string[];
  /** Complete types of the scoped input events, expanded with captured children. */
  readonly eventTypes?: readonly string[];
  readonly topicMap?: TopicMap;
  readonly nextCheckpoint?: () => string;
  readonly maxPasses?: number;
  readonly limit?: number;
};

/** Drain bounded causal passes, publishing each committed result before the next pass. */
export async function drainAndNotifyOutbox(
  args: DrainAndNotifyArgs
): Promise<number> {
  if (args.causationIds?.length === 0) return 0;
  const consumers = args.consumerRegistry ?? getOutboxConsumerRegistry();
  const eventIds =
    args.eventIds === undefined ? undefined : new Set(args.eventIds);
  if (eventIds?.size === 0) return 0;
  let eventTypes =
    args.eventTypes === undefined ? undefined : new Set(args.eventTypes);
  const maxPasses = args.maxPasses ?? 8;
  let processed = 0;
  for (let pass = 0; pass < maxPasses; pass++) {
    const capture = capturedPass(
      args,
      eventTypes === undefined
        ? consumers
        : consumersForEvents(consumers, eventTypes),
      eventIds === undefined ? undefined : [...eventIds]
    );
    const result = await drainOutbox(capture.deps);
    processed += result.processed;
    const captured = capturedOutboxScope(
      capture.committed.map((part) => part.getCapture())
    );
    for (const id of captured.eventIds) eventIds?.add(id);
    eventTypes = extendEventTypes(eventTypes, captured.eventTypes);
    if (result.processed === 0) break;
    if (pass + 1 >= maxPasses) break;
    // Captured appends retain the next pass, even if their savepoint rolled back.
    const eventWrites = capture.attempted.some((part) =>
      part.getCapture().tables.includes('outbox_events')
    );
    if (!eventWrites && !(await hasDueOutboxWork(capture.deps))) break;
  }
  return processed;
}

/** Only successful handlers' images survive their savepoints and may be published. */
function capturedPass(
  args: DrainAndNotifyArgs,
  registry: OutboxConsumerRegistry,
  eventIds: readonly string[] | undefined
) {
  const attempted: ReturnType<typeof wrapMutationDb>[] = [];
  const committed: ReturnType<typeof wrapMutationDb>[] = [];
  let notified = 0;
  const deps: DrainOutboxDeps = {
    db: args.db,
    clock: args.clock,
    createId: args.createId,
    registry,
    objectStore: args.objectStore,
    observePhase: (stage, run) => observeSync(stage, run),
    measureDelivery: (info) =>
      registry.get(info.consumerId)?.delivery === 'background'
        ? () => undefined
        : beginSyncMeasurement(
            'delivery',
            args.clock.now() - info.eligibleAtMs
          ),
    observeOldestReady: (eligibleAtMs) =>
      observeOutboxReadyAge(
        eligibleAtMs === null ? 0 : args.clock.now() - eligibleAtMs
      ),
    afterDelivery: async (result) => {
      countExhaustedOutboxDeliveries(result.exhausted);
      await notifyCommittedPass(
        args,
        registry,
        committed.slice(notified),
        result.notifyUserIds
      );
      notified = committed.length;
    },
    observeDelivery: (info, run) => {
      // The drain constructs this handler's wrapper immediately before observing it.
      const capture = attempted.at(-1);
      return observeOutboxDelivery(info, async () => {
        const result = await run();
        if (result.ok && capture !== undefined) committed.push(capture);
        return result;
      });
    },
    ...(args.limit === undefined ? {} : { limit: args.limit }),
    ...(eventIds === undefined ? {} : { eventIds }),
    ...(args.causationIds === undefined
      ? {}
      : { causationIds: args.causationIds }),
    wrapConsumerTx: (tx) => {
      const wrapped = wrapMutationDb(tx, accountMutationEnv('', args));
      attempted.push(wrapped);
      return wrapped.tx;
    },
  };
  return { deps, attempted, committed };
}

async function notifyCommittedPass(
  args: DrainAndNotifyArgs,
  consumers: OutboxConsumerRegistry,
  captures: readonly ReturnType<typeof wrapMutationDb>[],
  notifyUserIds: readonly string[]
): Promise<void> {
  const store = apiRequestAsyncLocalStorage.getStore();
  const plan = await outboxNotificationPlan({
    topicMap: args.topicMap ?? topicMaps.get(consumers),
    captures: captures.map((capture) => capture.getCapture()),
    notifyUserIds,
    db: args.db,
    ctx: topicMapCtxFromEnv(
      accountMutationEnv(notifyUserIds[0] ?? 'system', args)
    ),
  });
  if (plan.topics.length === 0) return;
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
    topics: plan.topics,
    // Row images require the same ordering fence as query snapshots. Hosts
    // without that clock keep invalidation-only pushes.
    ...(plan.rowsByTopic === undefined || args.nextCheckpoint === undefined
      ? {}
      : { rowsByTopic: plan.rowsByTopic }),
    ...(args.nextCheckpoint === undefined
      ? {}
      : { checkpoint: args.nextCheckpoint() }),
    tables: [
      ...new Set(captures.flatMap((capture) => capture.getCapture().tables)),
    ].sort(),
    label: 'outbox-drain',
    now: args.clock.now,
  });
}
