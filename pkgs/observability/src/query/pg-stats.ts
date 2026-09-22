export type PgStatementStat = {
  readonly calls: number;
  readonly exampleTraceId?: string;
  readonly meanExecMs: number;
  readonly query: string;
  readonly queryId: string;
  readonly rows: number;
  readonly totalExecMs: number;
};

export type PgStatsResult =
  | {
      readonly available: true;
      readonly statements: readonly PgStatementStat[];
    }
  | { readonly available: false; readonly note: string };

export interface PgStatsSource {
  slowest(limit: number): Promise<PgStatsResult>;
}
