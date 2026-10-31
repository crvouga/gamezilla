import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { QueryRegistry } from '@pkgs/sync-engine-shared-ts/queries-types';
import type {
  QueryRequestItem,
  QueryResponse,
} from '@pkgs/sync-engine-shared-ts/v2';
import { stampScopeConfirmed } from './last-synced';
import { computeLocalScopeHash } from './local-scope-hash';
import type { MergeApplierDeps } from './merge';
import { applyFullMerge, detachScope } from './merge';
import { postQueryBatch } from './post-query-batch';
import { loadScopeBasis, requestCacheKeys } from './subscription-cache-keys';

export type SweepEntry = {
  readonly spec: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
    readonly settleOnNetworkError?: boolean;
  };
  readonly scope: string;
  firstSync: Promise<void>;
  resolveFirst: () => void;
  firstDone: boolean;
  refs: number;
  generation: number;
  stopped: boolean;
};

export type SubscriptionSweepContext = {
  readonly db: SqlClient;
  readonly postQueries: (
    requests: readonly QueryRequestItem[]
  ) => Promise<readonly QueryResponse[]>;
  readonly getMergeDeps: () => MergeApplierDeps;
  readonly queryRegistry?: QueryRegistry;
  readonly onError: (error: unknown) => void;
  readonly onSynced: () => void;
  readonly onScopeSettled?: (scope: string) => void;
  readonly ensureBusWatch: () => void;
  readonly cleanScopes: Set<string>;
  readonly isRunning: () => boolean;
};

export function markSweepFirst(entry: SweepEntry): void {
  if (entry.firstDone) return;
  entry.firstDone = true;
  entry.resolveFirst();
}

function isHttpNetworkError(error: unknown): boolean {
  return (
    error instanceof HttpNetworkError ||
    (error instanceof Error && error.name === 'HttpNetworkError')
  );
}

export function markFirstOnNetworkError(
  active: readonly SweepEntry[],
  gens: Map<string, number>,
  ctx: Pick<SubscriptionSweepContext, 'isRunning'>
): void {
  for (const entry of active) {
    if (entry.spec.settleOnNetworkError !== true) continue;
    if (gens.get(entry.scope) !== entry.generation) continue;
    if (!ctx.isRunning() || entry.stopped) continue;
    markSweepFirst(entry);
  }
}

export async function buildSweepRequests(
  ctx: SubscriptionSweepContext,
  active: readonly SweepEntry[]
): Promise<QueryRequestItem[]> {
  ctx.ensureBusWatch();
  const requests: QueryRequestItem[] = [];
  for (const entry of active) {
    const cache = await requestCacheKeys({
      db: ctx.db,
      entry,
      queryRegistry: ctx.queryRegistry,
      getMergeDeps: ctx.getMergeDeps,
      scopeClean: ctx.cleanScopes.has(entry.scope),
    });
    requests.push({
      name: entry.spec.name,
      params: entry.spec.params,
      ...cache,
    });
  }
  return requests;
}

async function handleSweepResponse(
  ctx: SubscriptionSweepContext,
  entry: SweepEntry,
  response: QueryResponse,
  capturedGen: number
): Promise<boolean> {
  const isCurrent = () =>
    capturedGen === entry.generation && ctx.isRunning() && !entry.stopped;
  if (!isCurrent()) return false;
  if (response.status === 'denied') {
    await detachScope(ctx.getMergeDeps(), entry.scope);
    // A denial clears its cache position, not the subscription. Identity or
    // policy may change while it is held; the next event must reauthorize it.
    if (isCurrent()) {
      markSweepFirst(entry);
      ctx.onScopeSettled?.(entry.scope);
    }
    return false;
  }
  if (response.status === 'not_modified') {
    const healed = await healNotModifiedIfDrifted(
      ctx,
      entry,
      response,
      isCurrent
    );
    if (healed) return true;
    if (!isCurrent()) return false;
    await stampScopeConfirmed(
      ctx.db,
      entry.scope,
      ctx.getMergeDeps().env.now()
    );
    if (!isCurrent()) return false;
    markSweepFirst(entry);
    ctx.onSynced();
    ctx.onScopeSettled?.(entry.scope);
    return true;
  }
  if (!isCurrent()) return false;
  await applyFullMerge(ctx.getMergeDeps(), {
    scopeHash: entry.scope,
    checkpoint: response.checkpoint,
    hash: response.hash,
    tables: response.tables,
    isCurrent,
  });
  if (!isCurrent()) return false;
  markSweepFirst(entry);
  ctx.onSynced();
  ctx.onScopeSettled?.(entry.scope);
  return true;
}

async function healNotModifiedIfDrifted(
  ctx: SubscriptionSweepContext,
  entry: SweepEntry,
  response: QueryResponse,
  isCurrent: () => boolean
): Promise<boolean> {
  if (response.status !== 'not_modified') return false;
  const basis = await loadScopeBasis(ctx.db, entry.scope);
  if (basis.last_hash === null) return false;

  const query = ctx.queryRegistry?.[entry.spec.name];
  if (query === undefined) return false;

  const mergeDeps = ctx.getMergeDeps();
  const localHash = await computeLocalScopeHash({
    db: ctx.db,
    query,
    params: entry.spec.params,
    env: mergeDeps.env,
  });
  if (localHash === basis.last_hash || !isCurrent()) return false;

  const [full] = await postQueryBatch(ctx.postQueries, [
    { name: entry.spec.name, params: entry.spec.params },
  ]);
  if (full === undefined || full.status !== 'ok' || !isCurrent()) return false;

  await applyFullMerge(mergeDeps, {
    scopeHash: entry.scope,
    checkpoint: full.checkpoint,
    hash: full.hash,
    tables: full.tables,
    isCurrent,
  });
  if (!isCurrent()) return false;
  markSweepFirst(entry);
  ctx.onSynced();
  ctx.onScopeSettled?.(entry.scope);
  return true;
}

export async function applySweepResponses(args: {
  readonly ctx: SubscriptionSweepContext;
  readonly active: readonly SweepEntry[];
  readonly gens: Map<string, number>;
  readonly responses: readonly QueryResponse[];
}): Promise<void> {
  if (args.responses.length !== args.active.length) {
    throw new Error(
      `query batch length mismatch: ${args.responses.length} responses for ${args.active.length} requests`
    );
  }
  const newlyClean: string[] = [];
  for (let i = 0; i < args.active.length; i += 1) {
    const entry = args.active[i]!;
    const response = args.responses[i];
    if (response === undefined) continue;
    if (args.gens.get(entry.scope) !== entry.generation) continue;
    if (!args.ctx.isRunning() || entry.stopped) continue;
    const clean = await handleSweepResponse(
      args.ctx,
      entry,
      response,
      args.gens.get(entry.scope) ?? -1
    );
    if (clean) newlyClean.push(entry.scope);
  }
  for (const scope of newlyClean) args.ctx.cleanScopes.add(scope);
}

export async function runSubscriptionSweep(
  ctx: SubscriptionSweepContext,
  active: readonly SweepEntry[]
): Promise<void> {
  if (active.length === 0) return;
  for (const entry of active) entry.generation += 1;
  const gens = new Map(active.map((e) => [e.scope, e.generation]));
  try {
    const requests = await buildSweepRequests(ctx, active);
    if (!ctx.isRunning()) return;
    const responses = await postQueryBatch(ctx.postQueries, requests);
    if (!ctx.isRunning()) return;
    await applySweepResponses({ ctx, active, gens, responses });
  } catch (error) {
    if (isHttpNetworkError(error)) {
      markFirstOnNetworkError(active, gens, ctx);
    }
    throw error;
  }
}
