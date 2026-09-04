import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { Hono } from 'hono';

import type { MutationRegistry } from '../mutations/core/types';
import { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
import type { AuthErrorBody, QueryRegistry } from '../queries/core/types';
import { createMonotonicCheckpoint } from '../shared/commit-checkpoint';
import { withFrameworkTopicMap } from '../shared/framework-topic-map';
import type { TopicMap } from '../shared/topic-map';
import type { SyncSqlVariables } from './resolve-request-sql';
import type { SyncAppAuth } from './sync-app-auth';
import { mountMutationsRoute } from './sync-app-mutations-route';
import { mountQueryRoutes } from './sync-app-query-routes';

export type CreateSyncAppDeps = {
  readonly resolveAuth: (
    request: Request
  ) => Promise<SyncAppAuth | AuthErrorBody>;
  readonly getSql: () => SqlClient;
  readonly queries: QueryRegistry;
  readonly mutations: MutationRegistry;
  /** Epoch ms for checkpoints / auth.now (composition root injects clock.now). */
  readonly now: () => number;
  readonly createId: CreateId;
  /** Optional push transport; omit to keep upload correct without pubsub. */
  readonly pubsub?: PubSub;
  readonly nextCheckpoint?: () => string;
  /** When true, publish post-replay row images on pushes (default false). */
  readonly rowImageFanout?: boolean;
  /** Per-table topic derivation (required for push invalidation). */
  readonly topicMap?: TopicMap;
  /**
   * When true, query hard-limit clips throw instead of silently truncating.
   * Product API sets this when SECRETS_ENV=dev; sim sets true.
   */
  readonly strictQueryLimits?: boolean;
};

/**
 * Single Hono app for sync: `POST /query` (batch body), `POST /mutations`.
 * Always merges framework mutations into the product registry.
 */
export function createSyncApp(deps: CreateSyncAppDeps) {
  // Per-app allocator — never module-scope (multi-sim / multi-app isolation).
  const nextCheckpoint =
    deps.nextCheckpoint ?? createMonotonicCheckpoint(deps.now).next;
  const mutations = withFrameworkMutations(deps.mutations);
  const app = new Hono<{ Variables: SyncSqlVariables }>();
  mountQueryRoutes(app, {
    resolveAuth: deps.resolveAuth,
    getSql: deps.getSql,
    queries: deps.queries,
    nextCheckpoint,
    now: deps.now,
    ...(deps.strictQueryLimits === true ? { strictQueryLimits: true } : {}),
  });
  const topicMap = withFrameworkTopicMap(deps.topicMap);
  mountMutationsRoute(app, {
    resolveAuth: deps.resolveAuth,
    getSql: deps.getSql,
    mutations,
    now: deps.now,
    createId: deps.createId,
    nextCheckpoint,
    ...(deps.pubsub !== undefined ? { pubsub: deps.pubsub } : {}),
    ...(deps.rowImageFanout === true ? { rowImageFanout: true } : {}),
    ...(topicMap !== undefined ? { topicMap } : {}),
  });
  return app;
}
