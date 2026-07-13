import type { SqlClient } from '@pkgs/sql-client/interface';

import { runWrite } from '../shared/run-write';
import type { WriteDefinition } from '../shared/define-write';
import type { WriteContext } from '../shared/write-context';
import { unwrap } from '../shared/write-result';

export async function runClientWrite<TInput, TOutput>(
  write: WriteDefinition<TInput, TOutput>,
  ctx: WriteContext,
  input: unknown,
  sql: SqlClient
): Promise<TOutput> {
  const result = await runWrite({
    write,
    ctx,
    rawInput: input,
    sql,
    mode: 'full',
  });
  return unwrap(result);
}
