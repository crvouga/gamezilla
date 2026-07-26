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

export type UploadRowResult =
  | { readonly status: 'accepted' }
  | { readonly status: 'rejected'; readonly reason: string };

export type UploadBatchResult = {
  readonly results: readonly UploadRowResult[];
};

export function createUploadBatch(rows: readonly UploadRow[]): UploadBatch {
  return { rows };
}

/**
 * Whether {@link applyRow} would run SQL for this upload row. Put/patch with
 * no columns are no-ops (e.g. after stripping server-owned profile fields).
 */
export function uploadRowNeedsApply(row: UploadRow): boolean {
  if (row.op === 'delete') return true;
  return Object.keys(row.values ?? {}).length > 0;
}
