import type { SqlClient } from '@pkgs/sql-client/interface';

import type { WriteContext } from './write-context';
import type { WriteResult } from './write-result';

export type WriteDefinition<TInput, TOutput> = {
  readonly name: string;
  readonly parseInput: (raw: unknown) => WriteResult<TInput>;
  readonly authorize: (
    ctx: WriteContext,
    input: TInput,
    sql: SqlClient
  ) => Promise<WriteResult<void>>;
  readonly execute: (
    ctx: WriteContext,
    input: TInput,
    sql: SqlClient
  ) => Promise<WriteResult<TOutput>>;
};

export function defineWrite<TInput, TOutput>(
  def: WriteDefinition<TInput, TOutput>
): WriteDefinition<TInput, TOutput> {
  return def;
}
