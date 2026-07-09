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
