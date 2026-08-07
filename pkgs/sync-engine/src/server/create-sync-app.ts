import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';

import type { MutationRegistry } from '../mutations/core/types';
import { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
import type { AuthErrorBody, QueryRegistry } from '../queries/core/types';
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
  /** Optional nudge transport; omit to keep upload correct without pubsub. */
  readonly pubsub?: PubSub;
  readonly nextCheckpoint?: () => string;
};

let checkpointSeq = 0;

function defaultNextCheckpoint(): string {
  checkpointSeq += 1;
  return `${Date.now()}${String(checkpointSeq).padStart(6, '0')}`;
}

/**
 * Single Hono app for sync: `POST /query` (batch body), `POST /mutations`.
 * Always merges framework mutations into the product registry.
 */
export function createSyncApp(deps: CreateSyncAppDeps) {
  const nextCheckpoint = deps.nextCheckpoint ?? defaultNextCheckpoint;
  const mutations = withFrameworkMutations(deps.mutations);
  const app = new Hono();
  mountQueryRoutes(app, {
    resolveAuth: deps.resolveAuth,
    getSql: deps.getSql,
    queries: deps.queries,
    nextCheckpoint,
  });
  mountMutationsRoute(app, {
    resolveAuth: deps.resolveAuth,
    getSql: deps.getSql,
    mutations,
    ...(deps.pubsub !== undefined ? { pubsub: deps.pubsub } : {}),
  });
  return app;
}
