import type {
  UploadBatch,
  UploadRow,
} from '@pkgs/sync-engine/shared/upload-batch';

import type {
  PowerSyncConnectorPort,
  PowerSyncCrudOp,
  PowerSyncCrudTransaction,
} from './powersync-database-port';

export type SyncTokenCredentials = {
  readonly token: string;
  readonly expiresAt: number;
};

export type CreateConnectorOptions = {
  readonly powersyncUrl: string;
  readonly fetchSyncToken: () => Promise<SyncTokenCredentials>;
  readonly uploadBatch: (batch: UploadBatch) => Promise<void>;
};

function mapCrudOp(op: PowerSyncCrudOp): UploadRow {
  const base = { table: op.table, id: op.id };
  if (op.op === 'DELETE') {
    return { op: 'delete', ...base };
  }
  if (op.op === 'PATCH') {
    return {
      op: 'patch',
      ...base,
      values: op.opData ?? {},
    };
  }
  return {
    op: 'put',
    ...base,
    values: { id: op.id, ...(op.opData ?? {}) },
  };
}

async function uploadTransaction(
  transaction: PowerSyncCrudTransaction,
  uploadBatch: (batch: UploadBatch) => Promise<void>
): Promise<void> {
  const rows = transaction.crud.map(mapCrudOp);
  await uploadBatch({ rows });
  await transaction.complete();
}

export function createPowerSyncConnector(
  options: CreateConnectorOptions
): PowerSyncConnectorPort {
  return {
    fetchCredentials: async () => {
      const credentials = await options.fetchSyncToken();
      return {
        endpoint: options.powersyncUrl,
        token: credentials.token,
        expiresAt: new Date(credentials.expiresAt * 1000),
      };
    },
    uploadData: async (database) => {
      const transaction = await database.getNextCrudTransaction();
      if (transaction === null) return;
      await uploadTransaction(transaction, options.uploadBatch);
    },
  };
}
