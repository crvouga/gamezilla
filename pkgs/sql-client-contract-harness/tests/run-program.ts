/**
 * Run a generated portable program against one backend; enforce wire-safety
 * on every query/run result.
 */

import type { MatrixBackend } from './types';
import type { ProgramStep } from './program';
import { renderCount, renderCreateTable, renderInsert, renderSelectAll, renderSoftDelete, renderUpdate } from './program';
import type { LogicalSchema, LogicalTable } from './schema';
import {
  assertWireSafeRows,
  assertWireSafeRunResult,
} from './wire-safety';

function requireTable(schema: LogicalSchema, name: string): LogicalTable {
  const table = schema.tables.find((t) => t.name === name);
  if (table === undefined) {
    throw new Error(`unknown table ${name}`);
  }
  return table;
}

export type ProgramResult = {
  readonly lastSelect: readonly Record<string, unknown>[];
  readonly lastCount: number | string | null;
};

export async function runProgramOnBackend(
  backend: MatrixBackend,
  schema: LogicalSchema,
  steps: readonly ProgramStep[]
): Promise<ProgramResult> {
  const label = backend.name;
  for (const table of schema.tables) {
    await backend.client.run(renderCreateTable(backend.dialect, table));
  }

  let lastSelect: readonly Record<string, unknown>[] = [];
  let lastCount: number | string | null = null;

  for (const step of steps) {
    switch (step.kind) {
      case 'insert': {
        const table = requireTable(schema, step.table);
        const result = await backend.client.run(renderInsert(table, step.row));
        assertWireSafeRunResult(result, `${label}:insert`);
        break;
      }
      case 'select': {
        const table = requireTable(schema, step.table);
        const rows = await backend.client.query(renderSelectAll(table));
        assertWireSafeRows(rows, `${label}:select`);
        lastSelect = rows;
        break;
      }
      case 'prepare_select': {
        const table = requireTable(schema, step.table);
        const stmt = backend.client.prepare(renderSelectAll(table));
        const rows = await stmt.query();
        assertWireSafeRows(rows, `${label}:prepare_select`);
        lastSelect = rows;
        break;
      }
      case 'update': {
        const table = requireTable(schema, step.table);
        if (Object.keys(step.patch).length === 0) break;
        const result = await backend.client.run(
          renderUpdate(table, step.id, step.patch)
        );
        assertWireSafeRunResult(result, `${label}:update`);
        break;
      }
      case 'soft_delete': {
        const table = requireTable(schema, step.table);
        const result = await backend.client.run(
          renderSoftDelete(table, step.id, step.deletedAt)
        );
        assertWireSafeRunResult(result, `${label}:soft_delete`);
        break;
      }
      case 'count': {
        const table = requireTable(schema, step.table);
        const rows = await backend.client.query(renderCount(table));
        assertWireSafeRows(rows, `${label}:count`);
        lastCount = rows[0]?.n ?? null;
        break;
      }
      case 'tx_rollback_insert': {
        const table = requireTable(schema, step.table);
        try {
          await backend.client.transaction(async (tx) => {
            await tx.run(renderInsert(table, step.row));
            throw new Error('rollback');
          });
        } catch (err: unknown) {
          if (!(err instanceof Error) || err.message !== 'rollback') throw err;
        }
        break;
      }
      default: {
        const _exhaustive: never = step;
        return _exhaustive;
      }
    }
  }

  return { lastSelect, lastCount };
}

export async function withBackendSample<T>(
  backend: MatrixBackend,
  schema: LogicalSchema,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } finally {
    await backend.cleanup(schema.tables.map((t) => t.name));
  }
}
