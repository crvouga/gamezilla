export type WriteRunResult = { readonly changes: number };

export interface WriteStore {
  query<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  run(sql: string, params?: readonly unknown[]): Promise<WriteRunResult>;
  transaction<T>(fn: (tx: WriteStore) => Promise<T>): Promise<T>;
}
