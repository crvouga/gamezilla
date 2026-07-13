import type { RowWriteRegistry } from '@pkgs/write/server/row-write-registry';
import { createRowEvaluator } from '@pkgs/write/server/row-write-registry';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import type { RowChange } from '@pkgs/write/shared/row-change';
import type { Context } from 'hono';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { UploadRow, UploadRowResult } from '../shared/upload-batch';
import { createUploadHandler } from './upload-handler';

export type WriteAuthorizedUploadHandlerOptions<TAuth> = {
  readonly resolveAuth: (c: Context) => Promise<TAuth | null>;
  readonly mapAuth: (auth: TAuth) => WriteContext;
  readonly rowRegistry: RowWriteRegistry;
  readonly openSql: () => Promise<SqlClient>;
};

function mapUploadRowToRowChange(row: UploadRow): RowChange {
  return {
    op: row.op,
    table: row.table,
    id: row.id,
    ...(row.values !== undefined ? { values: row.values } : {}),
  };
}

function createUploadRowEvaluator(
  rowRegistry: RowWriteRegistry
): (
  ctx: WriteContext,
  row: UploadRow,
  sql: SqlClient
) => Promise<UploadRowResult> {
  const evaluateRow = createRowEvaluator(rowRegistry);
  return async (ctx, row, sql) => {
    const result = await evaluateRow(ctx, mapUploadRowToRowChange(row), sql);
    if (result.status === 'rejected') {
      return { status: 'rejected', reason: result.code };
    }
    return { status: 'accepted' };
  };
}

export function createWriteAuthorizedUploadHandler<TAuth>(
  options: WriteAuthorizedUploadHandlerOptions<TAuth>
) {
  return createUploadHandler({
    resolveAuth: options.resolveAuth,
    mapAuth: options.mapAuth,
    evaluateRow: createUploadRowEvaluator(options.rowRegistry),
    openSql: options.openSql,
  });
}
