import { fingerprintSql } from '../../core/fingerprint';
import { isOwnedName } from '../../core/naming';
import type { WorkloadManifest } from '../../core/types';
import {
  checkInvariantsAsync,
  type InvariantViolation as HarnessViolation,
} from '../../sim/harness';
import type { IndexesReconcilerHandle } from './nodes';

export async function checkIndexesInvariants(
  state: IndexesReconcilerHandle
): Promise<void> {
  const opts =
    state.lastReport !== null
      ? {
          lastCompleted: state.lastReport.completed.map((a) => ({
            kind: a.kind,
            name: a.name as string,
          })),
        }
      : {};
  const v = await checkInvariantsAsync(state.db, state.maxPerTable, opts);
  if (v.length > 0) {
    throw new Error(`${v[0]!.id}: ${v[0]!.detail}`);
  }
  if (state.lastReport !== null) {
    for (const a of state.lastReport.completed) {
      if (!isOwnedName(a.name)) {
        throw new Error(`I1_executed: executed non-owned ${a.name}`);
      }
    }
  }
}

export function harnessToDeterminism(v: HarnessViolation): {
  invariant: string;
  detail: string;
} {
  return { invariant: v.id, detail: v.detail };
}

export function manifestForCol(table: string, col: string): WorkloadManifest {
  const sql = `SELECT id FROM ${table} WHERE ${col} = ?`;
  return {
    version: 1,
    queries: [
      {
        name: `q_${table}_${col}`,
        hydrates: [table],
        statements: [
          {
            index: 0,
            sql,
            fingerprint: fingerprintSql(sql),
            weight: 1,
          },
        ],
      },
    ],
  };
}
