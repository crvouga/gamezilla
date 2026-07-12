import type { RunResult, SqlClient } from '@pkgs/sql-client/interface';

export type SqlCliResult =
  | { kind: 'rows'; rows: readonly Record<string, unknown>[] }
  | { kind: 'run'; result: RunResult }
  | { kind: 'message'; message: string }
  | { kind: 'empty' };

export type SqlCliHandler = (
  input: string,
  client: SqlClient
) => Promise<SqlCliResult>;

export type SqlCliCommand = {
  description: string;
  match: RegExp;
  handler: SqlCliHandler;
};

export type SqlCliFn = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<SqlCliResult>;
