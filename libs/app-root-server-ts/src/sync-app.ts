import { resolveSessionReplayAuth } from '@libs/app-root-shared-ts/query-auth';
import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared-ts/request-scope';
import type { ModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { authorizeAppMutation } from '@libs/permissions-shared-ts/authorize-app-mutation';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import type { ComposedSubs } from '@libs/sub-shared-ts/compose';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import { PubSubNotSupportedError } from '@pkgs/pubsub-root-shared-ts/pubsub-not-supported-error';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { createSyncApp as createSyncEngineApp } from '@pkgs/sync-engine-server-ts/create-sync-app';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared-ts/mutations-types';
import {
  drainCommittedMutationOutbox,
  scopeMutationOutbox,
} from './mutation-outbox';
import { requestOutboxRegistry } from './outbox-drain';
import { countTruncatedQuery } from './query-truncation';

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'sync sql: request store missing');
  return requestStore.sqlClient;
}

/** Resolves the publish-only invalidation client from the request secret store. */
function createRequestScopedPubSub(): PubSub {
  return {
    async publish(topic, data) {
      const store = apiRequestAsyncLocalStorage.getStore();
      if (store === undefined) return;
      const pubsub = await new HttpPubSubFromSecretStore(
        store.secretStore,
        () => store.clock.now(),
        store.http
      ).get();
      if (pubsub === undefined) return;
      await pubsub.publish(topic, data);
    },
    subscribe() {
      throw new PubSubNotSupportedError('API pubsub is publish-only');
    },
    status: () => 'connected',
    onStatus: () => () => undefined,
    close: () => undefined,
  };
}

/**
 * Sync mount: `POST /api/query` (batch body), `/api/mutations`.
 *
 * Serves exactly what the composed subs declared — the whole product on
 * the API, one bounded context in a subsystem harness.
 */
export async function createSyncApp(deps: {
  /** The folded sub set: schema, queries, wake topics, mutations. */
  readonly app: ComposedSubs;
  readonly outboxConsumers: OutboxConsumerRegistry;
  /** The subs' server-only mutation checks (rooms they read); none by default. */
  readonly authorizeServerMutation?: MutationAuthorize;
  readonly now: () => number;
  readonly createId: () => string;
  /** Rules supplied at each mutation's selected replay judgment time. */
  readonly moderation: ModerationRules;
  /** Enables dev-only query limit strictness (on unless `ServerEnv.protection` is `production`). */
  readonly strictQueryLimits?: boolean;
}) {
  let checkpointSeq = 0;
  const nextCheckpoint = (): string => {
    checkpointSeq += 1;
    return `${String(deps.now())}${String(checkpointSeq).padStart(6, '0')}`;
  };
  const mutations = await deps.app.mutations();
  return createSyncEngineApp({
    resolveAuth: resolveSessionReplayAuth,
    getSql: openRequestSqlClient,
    queries: deps.app.queries,
    mutations,
    wrapMutationTx: scopeMutationOutbox,
    authorizeMutation: async (ctx) => {
      await authorizeAppMutation(ctx);
      await deps.app.authorizeMutation(ctx);
      await deps.authorizeServerMutation?.(ctx);
    },
    now: deps.now,
    createId: deps.createId,
    turnGames: deps.app.turnGames,
    contentRulesAt: (atMs) => deps.moderation.at(atMs),
    pubsub: createRequestScopedPubSub(),
    rowImageFanout: true,
    topicMap: deps.app.topicMap,
    onCommittedMutations: async (batch) => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'sync outbox: request store missing');
      await drainCommittedMutationOutbox({
        batch,
        consumerRegistry: requestOutboxRegistry(deps.outboxConsumers),
        nextCheckpoint,
        objectStore: store.objectStore,
        clock: store.clock,
        createId: store.createId,
      });
    },
    nextCheckpoint,
    ...(deps.strictQueryLimits === true ? { strictQueryLimits: true } : {}),
    onQueryTruncated: countTruncatedQuery(
      createLogger({ name: 'sync:query', now: deps.now })
    ),
  });
}
