import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { FRAMEWORK_MUTATIONS } from '@pkgs/sync-engine-shared-ts/acknowledge-write-rejection';
import { createMonotonicCheckpoint } from '@pkgs/sync-engine-shared-ts/commit-checkpoint';
import { withFrameworkTopicMap } from '@pkgs/sync-engine-shared-ts/framework-topic-map';
import type {
  ContentRules,
  MutationAuthorize,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { QueryRegistry } from '@pkgs/sync-engine-shared-ts/queries-types';
import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import type { AuthErrorBody } from '@pkgs/sync-engine-shared-ts/v2';
import { withFrameworkMutations } from '@pkgs/sync-engine-shared-ts/with-framework-mutations';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { Hono } from 'hono';
import type { SyncSqlVariables } from './resolve-request-sql';
import type { QueryTruncation } from './run-query';
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
   * Product API sets this outside production; harness sets true.
   */
  readonly strictQueryLimits?: boolean;
  /** Told about each snapshot clipped to its query limit (no row content). */
  readonly onQueryTruncated?: (clip: QueryTruncation) => void;
  /**
   * Server guard run inside replay before every product mutation body (the
   * framework's own bookkeeping mutations skip it). Throw `MutationError` to
   * reject.
   */
  readonly authorizeMutation?: MutationAuthorize;
  /**
   * The app's content rules as they stood at a write's time (its
   * `created_at`), handed to the mutation body as `env.contentRules`.
   */
  readonly turnGames?: TurnGames;
  readonly contentRulesAt?: (atMs: number) => ContentRules;
};

const FRAMEWORK_MUTATION_NAMES: ReadonlySet<string> = new Set(
  FRAMEWORK_MUTATIONS.map((m) => m.name)
);

function productOnly(authorize: MutationAuthorize): MutationAuthorize {
  return async (ctx) => {
    if (FRAMEWORK_MUTATION_NAMES.has(ctx.name)) return;
    await authorize(ctx);
  };
}

/**
 * Single Hono app for sync: `POST /query` (batch body), `POST /mutations`.
 * Always merges framework mutations into the product registry.
 */
export function createSyncApp(deps: CreateSyncAppDeps) {
  // Per-app allocator — never module-scope (multi-harness / multi-app isolation).
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
    ...(deps.onQueryTruncated === undefined
      ? {}
      : { onQueryTruncated: deps.onQueryTruncated }),
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
    ...(deps.authorizeMutation !== undefined
      ? { authorize: productOnly(deps.authorizeMutation) }
      : {}),
    ...(deps.turnGames === undefined ? {} : { turnGames: deps.turnGames }),
    ...(deps.contentRulesAt !== undefined
      ? { contentRulesAt: deps.contentRulesAt }
      : {}),
  });
  return app;
}
