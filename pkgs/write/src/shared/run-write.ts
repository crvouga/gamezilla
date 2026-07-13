import type { SqlClient } from '@pkgs/sql-client/interface';

import type { WriteDefinition } from './define-write';
import type { WriteContext } from './write-context';
import { isWriteFailure, type WriteResult } from './write-result';

export type RunWriteMode = 'full' | 'authorize-only';

export type RunWriteInput<TInput, TOutput> = {
  readonly write: WriteDefinition<TInput, TOutput>;
  readonly ctx: WriteContext;
  readonly rawInput: unknown;
  readonly sql: SqlClient;
  readonly mode?: RunWriteMode;
};

export async function runWrite<TInput, TOutput>(
  input: RunWriteInput<TInput, TOutput>
): Promise<WriteResult<TOutput>> {
  const mode = input.mode ?? 'full';
  const parsed = input.write.parseInput(input.rawInput);
  if (isWriteFailure(parsed)) {
    return parsed;
  }
  const authorized = await input.write.authorize(
    input.ctx,
    parsed.value,
    input.sql
  );
  if (isWriteFailure(authorized)) {
    return authorized;
  }
  if (mode === 'authorize-only') {
    return { ok: true, value: undefined as TOutput };
  }
  return input.write.execute(input.ctx, parsed.value, input.sql);
}
