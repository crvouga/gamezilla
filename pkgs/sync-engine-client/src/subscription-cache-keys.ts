import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';

import type { QueryRegistry } from '@pkgs/sync-engine-shared/queries-types';
import { computeLocalScopeHash } from './local-scope-hash';
import type { MergeApplierDeps } from './merge';

export type ScopeCacheEntry = {
  readonly scope: string;
  readonly spec: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
};

export async function loadScopeBasis(
  db: SqlClient,
  scope: string
): Promise<{ last_checkpoint: string | null; last_hash: string | null }> {
  const rows = await db.query(sql<{
    last_checkpoint: string | null;
    last_hash: string | null;
  }>`
    SELECT last_checkpoint, last_hash
    FROM sync_engine_scope_meta
    WHERE scope_hash = ${scope}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  const meta = rows[0];
  return {
    last_checkpoint: meta?.last_checkpoint ?? null,
    last_hash: meta?.last_hash ?? null,
  };
}

/**
 * Build lastHash/checkpoint for a sweep request.
 * When `scopeClean`, skip local re-hash (happy path on low-end mobile web).
 */
export async function requestCacheKeys(args: {
  readonly db: SqlClient;
  readonly entry: ScopeCacheEntry;
  readonly queryRegistry: QueryRegistry | undefined;
  readonly getMergeDeps: () => MergeApplierDeps;
  readonly scopeClean: boolean;
}): Promise<{ readonly lastHash?: string; readonly checkpoint?: string }> {
  const basis = await loadScopeBasis(args.db, args.entry.scope);
  const checkpoint =
    basis.last_checkpoint !== null ? { checkpoint: basis.last_checkpoint } : {};
  if (basis.last_hash === null) return checkpoint;

  if (args.scopeClean) {
    return { lastHash: basis.last_hash, ...checkpoint };
  }

  const query = args.queryRegistry?.[args.entry.spec.name];
  if (query === undefined) {
    return { lastHash: basis.last_hash, ...checkpoint };
  }

  const localHash = await computeLocalScopeHash({
    db: args.db,
    query,
    params: args.entry.spec.params,
    env: args.getMergeDeps().env,
  });
  if (localHash !== basis.last_hash) {
    // Local rows drifted from scope meta — omit lastHash to force full merge.
    return checkpoint;
  }
  return { lastHash: basis.last_hash, ...checkpoint };
}
