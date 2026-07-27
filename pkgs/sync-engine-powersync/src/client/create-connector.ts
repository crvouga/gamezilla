import {
  uploadRowNeedsApply,
  type UploadBatch,
  type UploadRow,
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

export function mapCrudOp(op: PowerSyncCrudOp): UploadRow {
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
  const rows = transaction.crud.map(mapCrudOp).filter(uploadRowNeedsApply);
  if (rows.length > 0) {
    await uploadBatch({ rows });
  }
  await transaction.complete();
}

export function createPowerSyncConnector(
  options: CreateConnectorOptions
): PowerSyncConnectorPort {
  return {
    fetchCredentials: async () => {
      const credentials = await options.fetchSyncToken();
      // #region agent log
      fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'115aa4'},body:JSON.stringify({sessionId:'115aa4',runId:'pre-fix',hypothesisId:'C',location:'create-connector.ts:fetchCredentials',message:'fetchCredentials',data:{endpointHost:(()=>{try{return new URL(options.powersyncUrl).host}catch{return 'bad'}})(),expiresAt:credentials.expiresAt},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
