import type { Timers } from '@pkgs/clock-shared-ts/types';
import {
  captureSyncMeasurement,
  recordUnknownSyncMeasurement,
  SYNC_PERFORMANCE_TARGETS,
  syncPerformanceEnabled,
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

const QUALIFICATION_DEADLINE_MS = Math.max(
  ...SYNC_PERFORMANCE_TARGETS.filter(
    (target) => target.stage === 'reconnect'
  ).map((target) => target.ms)
);

/** Observe the original backlog and scope set; telemetry never wakes or changes sync. */
export function createRecoveryObservation(
  db: SqlClient,
  clientId: () => string,
  options: { readonly timers: Timers; readonly uploadsLocally: boolean }
) {
  let current: Recovery | null = null;
  let qualificationTimer: unknown;
  const clearQualification = () => {
    if (qualificationTimer !== undefined)
      options.timers.clearTimeout(qualificationTimer);
    qualificationTimer = undefined;
  };
  const cancel = () => {
    clearQualification();
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
      const rows = await readBacklog(db, clientId());
      if (current !== run) return;
      clearQualification();
      if (!isQualifiedBacklog(rows, run.acknowledged)) {
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
      cancel();
    }
  };
  const start = (scopes: readonly string[]) => {
    cancel();
    if (!syncPerformanceEnabled()) return;
    // Shared-storage followers cannot observe the leader's durable verdicts.
    if (!options.uploadsLocally) {
      recordUnknownSyncMeasurement('reconnect');
      return;
    }
    const run = recoveryState(scopes);
    current = run;
    // An unresponsive database cannot establish the reference workload.
    qualificationTimer = options.timers.setTimeout(() => {
      if (current === run && run.finish === null) cancel();
    }, QUALIFICATION_DEADLINE_MS);
    void qualify(run, captureSyncMeasurement());
  };
  return {
    start,
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
      retainRecoveryScopes(current, scopes);
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

function readBacklog(db: SqlClient, clientId: string) {
  // Bound both telemetry memory and SQL work. The extra KiB per row is a
  // conservative wire-envelope allowance. Six bytes per source byte bounds
  // JSON escaping; near-boundary work stays unknown.
  return db.query(sql<{ id: string; bytes: number }>`
    SELECT id, 6 * (LENGTH(CAST(args AS BLOB)) + LENGTH(CAST(name AS BLOB))
      + LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(client_id AS BLOB)))
      + 1024 AS bytes
    FROM sync_engine_mutations
    WHERE deleted_at IS NULL AND client_id = ${clientId}
    ORDER BY seq ASC LIMIT 101
  `);
}

function isQualifiedBacklog(
  rows: readonly { id: string; bytes: number }[],
  acknowledged: ReadonlySet<string>
): boolean {
  return (
    rows.length <= 100 &&
    [...acknowledged].every((id) => rows.some((row) => row.id === id)) &&
    rows.every(
      (row) => Number.isFinite(Number(row.bytes)) && Number(row.bytes) >= 0
    ) &&
    rows.reduce((total, row) => total + Number(row.bytes), 0) <= 1024 * 1024
  );
}

function retainRecoveryScopes(run: Recovery | null, scopes: readonly string[]) {
  const retained = new Set(scopes);
  for (const scope of run?.originalScopes ?? []) {
    if (retained.has(scope)) continue;
    run?.scopes.delete(scope);
    run?.originalScopes.delete(scope);
  }
}
