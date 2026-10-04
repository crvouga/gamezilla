import { assert } from '@pkgs/assert-shared/singleton';

import type { UploadBatch, UploadRow } from '@pkgs/sync-engine-shared/upload-batch';

function parseUploadRow(item: unknown): UploadRow {
  assert.record(item, 'upload row must be object');
  const op = item['op'];
  assert.ok(op === 'put' || op === 'patch' || op === 'delete', 'invalid op');
  const table = item['table'];
  assert.string(table, 'table required');
  const id = item['id'];
  assert.string(id, 'id required');
  const values = item['values'];
  if (values !== undefined) {
    assert.record(values, 'values must be object when present');
  }
  return {
    op,
    table,
    id,
    ...(values !== undefined ? { values } : {}),
  };
}

export function parseUploadBody(bodyRaw: unknown): UploadBatch {
  assert.record(bodyRaw, 'upload body must be object');
  const rowsRaw = bodyRaw['rows'];
  assert.array(rowsRaw, 'upload rows required');
  assert.ok(rowsRaw.length > 0, 'upload rows must not be empty');
  return { rows: rowsRaw.map(parseUploadRow) };
}
