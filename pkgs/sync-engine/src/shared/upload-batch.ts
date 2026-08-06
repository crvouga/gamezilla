export type UploadOp = 'put' | 'patch' | 'delete';

export type UploadRow = {
  readonly op: UploadOp;
  readonly table: string;
  readonly id: string;
  readonly values?: Readonly<Record<string, unknown>>;
};

export type UploadBatch = {
  readonly rows: readonly UploadRow[];
};

export function createUploadBatch(rows: readonly UploadRow[]): UploadBatch {
  return { rows };
}

/** Mutation upload ignores empty raw CRUD operations. */
export function uploadRowNeedsApply(row: UploadRow): boolean {
  if (row.op === 'delete') return true;
  return Object.keys(row.values ?? {}).length > 0;
}
