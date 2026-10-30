import {
  captureSyncMeasurement,
  recordUnknownSyncMeasurement,
} from '@pkgs/observability-root-shared-ts/metric-contract';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

type Recovery = {
  readonly scopes: Set<string>;
  readonly originalScopes: Set<string>;
  readonly startedScopes: Set<string>;
  readonly acknowledged: Set<string>;
  pending: Set<string>;
  finish: ((success: boolean) => void) | null;
};

/** Observe the original backlog and scope set; telemetry never wakes or changes sync. */
export function createRecoveryObservation(
  db: SqlClient,
  clientId: () => string
) {
  let current: Recovery | null = null;
  const cancel = () => {
    if (current?.finish === null) recordUnknownSyncMeasurement('reconnect');
    current?.finish?.(false);
    current = null;
  };
  const complete = () => {
    if (current?.finish === null || current === null) return;
    if (current.pending.size > 0 || current.scopes.size > 0) return;
    current.finish(true);
    current = null;
  };
  const qualify = async (
    run: Recovery,
    begin: ReturnType<typeof captureSyncMeasurement>
  ) => {
    try {
      // Bound both telemetry memory and SQL work. The extra KiB per row is a
      // conservative wire-envelope allowance. Six bytes per source byte bounds
      // JSON escaping; near-boundary work stays unknown.
      const rows = await db.query(sql<{ id: string; bytes: number }>`
        SELECT id, 6 * (LENGTH(CAST(args AS BLOB)) + LENGTH(CAST(name AS BLOB))
          + LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(client_id AS BLOB)))
          + 1024 AS bytes
        FROM sync_engine_mutations
        WHERE deleted_at IS NULL AND client_id = ${clientId()}
        ORDER BY seq ASC LIMIT 101
      `);
      if (current !== run) return;
      if (
        rows.length > 100 ||
        [...run.acknowledged].some(
          (id) => !rows.some((row) => row.id === id)
        ) ||
        rows.some(
          (row) => !Number.isFinite(Number(row.bytes)) || Number(row.bytes) < 0
        ) ||
        rows.reduce((total, row) => total + Number(row.bytes), 0) > 1024 * 1024
      ) {
        recordUnknownSyncMeasurement('reconnect');
        current = null;
        return;
      }
      run.pending = new Set(
        rows.map((row) => row.id).filter((id) => !run.acknowledged.has(id))
      );
      run.finish = begin('reconnect');
      complete();
    } catch {
      if (current !== run) return;
      recordUnknownSyncMeasurement('reconnect');
      current = null;
    }
  };
  return {
    start(scopes: readonly string[]) {
      cancel();
      const run = recoveryState(scopes);
      current = run;
      void qualify(run, captureSyncMeasurement());
    },
    scopesStarted(scopes: readonly string[]) {
      for (const scope of scopes)
        if (current?.scopes.has(scope)) current.startedScopes.add(scope);
    },
    scopeSettled(scope: string) {
      if (current?.startedScopes.has(scope)) current.scopes.delete(scope);
      complete();
    },
    acknowledged(ids: readonly string[], requiresRepair = false) {
      if (requiresRepair && current !== null) {
        for (const scope of current.originalScopes) current.scopes.add(scope);
        current.startedScopes.clear();
      }
      for (const id of ids) {
        if (current?.finish === null) current.acknowledged.add(id);
        if (current !== null && current.acknowledged.size > 100) {
          cancel();
          return;
        }
        current?.pending.delete(id);
      }
      complete();
    },
    retainScopes(scopes: readonly string[]) {
      const retained = new Set(scopes);
      for (const scope of current?.originalScopes ?? []) {
        if (retained.has(scope)) continue;
        current?.scopes.delete(scope);
        current?.originalScopes.delete(scope);
      }
      complete();
    },
    cancel,
  };
}

function recoveryState(scopes: readonly string[]): Recovery {
  return {
    scopes: new Set(scopes),
    originalScopes: new Set(scopes),
    startedScopes: new Set(),
    acknowledged: new Set(),
    pending: new Set(),
    finish: null,
  };
}
