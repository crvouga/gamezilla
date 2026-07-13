import type { SqlClient } from '@pkgs/sql-client/interface';

import { defineWrite, type WriteDefinition } from '../shared/define-write';
import type { RowChange } from '../shared/row-change';
import { parseRowChange, rowChangeToInput } from '../shared/row-change';
import { fail, ok, type WriteResult } from '../shared/write-result';
import type { WriteContext } from '../shared/write-context';

export function defineRowAuthorizeWrite(args: {
  readonly name: string;
  readonly authorize: (
    ctx: WriteContext,
    row: RowChange,
    sql: SqlClient
  ) => Promise<WriteResult<void>>;
}): WriteDefinition<RowChange, void> {
  return defineWrite({
    name: args.name,
    parseInput: parseRowChange,
    authorize: args.authorize,
    execute: async () => ok(undefined),
  });
}

export function defineDenyRowWrite(
  code: string
): WriteDefinition<RowChange, void> {
  return defineRowAuthorizeWrite({
    name: `deny.${code}`,
    authorize: async () => fail(code, 'write denied'),
  });
}

export type RowWriteBinding<TInput> = {
  readonly write: WriteDefinition<TInput, unknown>;
  readonly rowToInput: (row: RowChange) => WriteResult<TInput>;
};

export type RowWriteRegistry = {
  get(table: string): RowWriteBinding<RowChange> | undefined;
};

/**
 * Bind a shared {@link WriteDefinition} to a sync-upload table so
 * `createRowEvaluator` reuses `write.authorize` (client full execute + server
 * authorize-only correctness). Prefer this over a duplicate
 * `defineRowAuthorizeWrite` that only mirrors ownership checks.
 */
export function createRowWriteBinding<TInput>(
  write: WriteDefinition<TInput, unknown>,
  rowToInput: (row: RowChange) => WriteResult<TInput> = rowChangeToInput as (
    row: RowChange
  ) => WriteResult<TInput>
): RowWriteBinding<TInput> {
  return { write, rowToInput };
}

export function createRowWriteRegistry(
  bindings: Readonly<Record<string, RowWriteBinding<RowChange>>>
): RowWriteRegistry {
  return {
    get: (table) => bindings[table],
  };
}

export function mergeRowWriteRegistries(
  ...parts: Readonly<Record<string, RowWriteBinding<RowChange>>>[]
): RowWriteRegistry {
  return createRowWriteRegistry(Object.assign({}, ...parts));
}

export type RowEvaluation =
  | { readonly status: 'accepted' }
  | { readonly status: 'rejected'; readonly code: string };

export function createRowEvaluator(
  registry: RowWriteRegistry
): (
  ctx: WriteContext,
  row: RowChange,
  sql: SqlClient
) => Promise<RowEvaluation> {
  return async (ctx, row, sql) => {
    const binding = registry.get(row.table);
    if (binding === undefined) {
      return { status: 'rejected', code: 'NO_WRITE_FOR_TABLE' };
    }
    const inputResult = binding.rowToInput(row);
    if (!inputResult.ok) {
      return { status: 'rejected', code: inputResult.code };
    }
    const authResult = await binding.write.authorize(
      ctx,
      inputResult.value,
      sql
    );
    if (!authResult.ok) {
      return { status: 'rejected', code: authResult.code };
    }
    return { status: 'accepted' };
  };
}

export function denyAllRowBinding(code: string): RowWriteBinding<RowChange> {
  return createRowWriteBinding(defineDenyRowWrite(code));
}
