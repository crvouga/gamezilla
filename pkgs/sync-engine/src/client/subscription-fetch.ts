import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  applyFullMerge,
  type MergeApplierDeps,
  purgeScope,
} from '@pkgs/sync-engine/queries/client/merge-applier';
import { readWriteEpoch } from '@pkgs/sync-engine/queries/client/write-epoch';
import type { QueryResponse } from '@pkgs/sync-engine/queries/core/types';

export type QueryRequest = {
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly lastHash?: string | undefined;
  readonly checkpoint?: string | undefined;
};

export type ScopeBasis = {
  readonly last_checkpoint: string | null;
  readonly last_hash: string | null;
  readonly write_epoch: number;
};

export type FetchEntry = {
  readonly scope: string;
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
};

export type FetchApplyOptions = {
  readonly db: SqlClient;
  readonly getMergeDeps: () => MergeApplierDeps;
  readonly onSynced: () => void;
  readonly markFirst: (scope: string) => void;
};

export async function loadBasis(
  db: SqlClient,
  scope: string
): Promise<ScopeBasis> {
  const rows = await db.query(sql<{
    last_checkpoint: string | null;
    last_hash: string | null;
  }>`
    SELECT last_checkpoint, last_hash
    FROM _scope_meta
    WHERE scope_hash = ${scope}
    LIMIT 1
  `);
  const writeEpoch = await readWriteEpoch(db);
  const meta = rows[0];
  return {
    last_checkpoint: meta?.last_checkpoint ?? null,
    last_hash: meta?.last_hash ?? null,
    write_epoch: writeEpoch,
  };
}

export function requestFromBasis(
  entry: FetchEntry,
  basis: ScopeBasis
): QueryRequest {
  return {
    name: entry.name,
    params: entry.params,
    ...(basis.last_hash !== null ? { lastHash: basis.last_hash } : {}),
    ...(basis.last_checkpoint !== null
      ? { checkpoint: basis.last_checkpoint }
      : {}),
  };
}

async function clearBasis(db: SqlClient, scope: string): Promise<void> {
  await db.run(sql`DELETE FROM _scope_meta WHERE scope_hash = ${scope}`);
}

export type ApplyAction = 'continue' | 'resync' | 'stop' | 'full';

/** Applies one QueryResponse to local SQLite. Returns 'full' when rows changed. */
export async function applyQueryResponse(
  options: FetchApplyOptions,
  entry: FetchEntry,
  response: QueryResponse,
  basisEpoch = 0
): Promise<ApplyAction> {
  if (response.status === 'resync') {
    await clearBasis(options.db, entry.scope);
    return 'resync';
  }
  if (response.status === 'denied' || response.status === 'gone') {
    await purgeScope(options.getMergeDeps(), entry.scope);
    options.markFirst(entry.scope);
    return 'stop';
  }
  if (response.status === 'not_modified') {
    options.markFirst(entry.scope);
    options.onSynced();
    return 'continue';
  }
  if (response.mode !== 'full') {
    throw new Error(`Unsupported query response mode: ${response.mode}`);
  }
  await applyFullMerge(options.getMergeDeps(), {
    scopeHash: entry.scope,
    checkpoint: response.checkpoint,
    hash: response.hash,
    tables: response.tables,
    basisEpoch,
  });
  options.markFirst(entry.scope);
  options.onSynced();
  return 'full';
}
