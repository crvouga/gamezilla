import { assert } from '@pkgs/assert';

import { fail, ok, type WriteResult } from './write-result';

export type RowChangeOp = 'put' | 'patch' | 'delete';

export type RowChange = {
  readonly op: RowChangeOp;
  readonly table: string;
  readonly id: string;
  readonly values?: Readonly<Record<string, unknown>>;
};

function parseRowChangeOp(raw: unknown): WriteResult<RowChangeOp> {
  if (raw !== 'put' && raw !== 'patch' && raw !== 'delete') {
    return fail('INVALID_ROW_CHANGE', 'row change op must be put, patch, or delete');
  }
  return ok(raw);
}

function parseNonEmptyString(
  raw: unknown,
  field: string
): WriteResult<string> {
  if (typeof raw !== 'string' || raw.length === 0) {
    return fail('INVALID_ROW_CHANGE', `row change ${field} is required`);
  }
  return ok(raw);
}

function parseRowValues(raw: unknown): WriteResult<Readonly<Record<string, unknown>> | undefined> {
  if (raw === undefined) {
    return ok(undefined);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail('INVALID_ROW_CHANGE', 'row change values must be an object');
  }
  return ok(raw as Readonly<Record<string, unknown>>);
}

export function parseRowChange(raw: unknown): WriteResult<RowChange> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_ROW_CHANGE', 'row change must be an object');
  }
  const record = raw as Record<string, unknown>;
  const opResult = parseRowChangeOp(record['op']);
  if (!opResult.ok) return opResult;
  const tableResult = parseNonEmptyString(record['table'], 'table');
  if (!tableResult.ok) return tableResult;
  const idResult = parseNonEmptyString(record['id'], 'id');
  if (!idResult.ok) return idResult;
  const valuesResult = parseRowValues(record['values']);
  if (!valuesResult.ok) return valuesResult;
  const values = valuesResult.value;
  if (values !== undefined) {
    return { ok: true, value: { op: opResult.value, table: tableResult.value, id: idResult.value, values } };
  }
  return { ok: true, value: { op: opResult.value, table: tableResult.value, id: idResult.value } };
}

export function rowChangeToInput(row: RowChange): WriteResult<RowChange> {
  return ok(row);
}

export function assertRowChange(raw: unknown): RowChange {
  const parsed = parseRowChange(raw);
  assert.ok(parsed.ok, parsed.ok ? 'row change valid' : parsed.message, {
    code: parsed.ok ? undefined : parsed.code,
  });
  return parsed.value;
}
