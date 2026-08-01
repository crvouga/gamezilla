import { describe, expect, test } from 'bun:test';

import type { PsCrudRow } from './validated-write';
import { mapPsCrudDataToUploadRow } from './validated-write';

/**
 * Contract: PowerSync SDK stores CRUD as `ps_crud(id, tx_id, data)` where
 * `data` is JSON `{ op, type, id, data? }`. Fail loudly if the SDK shape drifts.
 */
describe('ps_crud shape contract', () => {
  test('maps PUT/PATCH/DELETE data payloads to UploadRow', () => {
    const put: PsCrudRow = {
      id: 1,
      tx_id: 1,
      data: JSON.stringify({
        op: 'PUT',
        type: 'profiles',
        id: 'u1',
        data: { avatar_config: '{}' },
      }),
    };
    expect(mapPsCrudDataToUploadRow(put.data)).toEqual({
      op: 'put',
      table: 'profiles',
      id: 'u1',
      values: { id: 'u1', avatar_config: '{}' },
    });

    const patch: PsCrudRow = {
      id: 2,
      tx_id: 1,
      data: JSON.stringify({
        op: 'PATCH',
        type: 'profiles',
        id: 'u1',
        data: { avatar_config: '{"a":1}' },
      }),
    };
    expect(mapPsCrudDataToUploadRow(patch.data)).toEqual({
      op: 'patch',
      table: 'profiles',
      id: 'u1',
      values: { avatar_config: '{"a":1}' },
    });

    const del: PsCrudRow = {
      id: 3,
      tx_id: 2,
      data: JSON.stringify({ op: 'DELETE', type: 'profiles', id: 'u1' }),
    };
    expect(mapPsCrudDataToUploadRow(del.data)).toEqual({
      op: 'delete',
      table: 'profiles',
      id: 'u1',
    });
  });

  test('required PsCrudRow keys match SDK CrudEntryJSON', () => {
    const required = ['id', 'tx_id', 'data'] as const;
    const sample: PsCrudRow = { id: 1, tx_id: null, data: '{}' };
    for (const key of required) {
      expect(key in sample).toBe(true);
    }
  });
});
