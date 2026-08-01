import type { SqlClient } from '@pkgs/sql-client/interface';

import type { UploadAuth } from '../shared/rules-auth';
import type { UploadBatch, UploadOp, UploadRow } from '../shared/upload-batch';
import { uploadRowNeedsApply } from '../shared/upload-batch';
import { applyRow } from './upload-handler';

export type ApplyBatchFailure = {
  readonly code: string;
  readonly table?: string;
  readonly id?: string;
};

export class ApplyBatchReject extends Error {
  readonly failures: readonly ApplyBatchFailure[];

  constructor(failures: readonly ApplyBatchFailure[]) {
    super(failures.map((f) => f.code).join(', ') || 'apply batch rejected');
    this.name = 'ApplyBatchReject';
    this.failures = failures;
  }
}

export type TablePolicy = {
  readonly table: string;
  readonly allowedOps: ReadonlySet<'put' | 'patch' | 'delete'>;
  readonly allowedColumns: ReadonlySet<string> | 'all';
  readonly authorize: (
    auth: UploadAuth,
    row: UploadRow,
    db: SqlClient
  ) => Promise<{ ok: true } | { ok: false; code: string }>;
};

export type TablePolicyRegistry = {
  get(table: string): TablePolicy | undefined;
};

export function createTablePolicyRegistry(
  policies: readonly TablePolicy[]
): TablePolicyRegistry {
  const byTable = new Map(policies.map((p) => [p.table, p]));
  return {
    get: (table) => byTable.get(table),
  };
}

export function denyTablePolicy(table: string, code: string): TablePolicy {
  // Allow ops so authorize runs and returns the domain-specific code
  // (e.g. CLIENT_CONFIG_SYSTEM_ONLY) instead of a generic OP_NOT_ALLOWED.
  return {
    table,
    allowedOps: new Set<UploadOp>(['put', 'patch', 'delete']),
    allowedColumns: 'all',
    authorize: async () => ({ ok: false, code }),
  };
}

function stripToAllowedColumns(
  row: UploadRow,
  allowedColumns: ReadonlySet<string> | 'all'
): UploadRow {
  if (row.op === 'delete' || row.values === undefined) return row;
  if (allowedColumns === 'all') return row;
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row.values)) {
    if (allowedColumns.has(key)) {
      values[key] = value;
    }
  }
  return { ...row, values };
}

function rejectRow(
  code: string,
  row: UploadRow
): ApplyBatchReject {
  return new ApplyBatchReject([
    { code, table: row.table, id: row.id },
  ]);
}

async function applyBatchRow(
  db: SqlClient,
  auth: UploadAuth,
  row: UploadRow,
  policies: TablePolicyRegistry
): Promise<void> {
  const policy = policies.get(row.table);
  if (policy === undefined) {
    throw rejectRow('NO_WRITE_FOR_TABLE', row);
  }
  if (!policy.allowedOps.has(row.op)) {
    throw rejectRow('OP_NOT_ALLOWED', row);
  }

  const filtered = stripToAllowedColumns(row, policy.allowedColumns);
  const authResult = await policy.authorize(auth, filtered, db);
  if (!authResult.ok) {
    throw rejectRow(authResult.code, filtered);
  }

  if (!uploadRowNeedsApply(filtered)) {
    return;
  }
  await applyRow(db, filtered);
}

/**
 * Apply an upload batch under table policies. Policy failures throw
 * {@link ApplyBatchReject}; SQL errors propagate for the caller's txn.
 */
export async function applyBatch(
  db: SqlClient,
  auth: UploadAuth,
  batch: UploadBatch,
  policies: TablePolicyRegistry
): Promise<void> {
  for (const row of batch.rows) {
    await applyBatchRow(db, auth, row, policies);
  }
}
