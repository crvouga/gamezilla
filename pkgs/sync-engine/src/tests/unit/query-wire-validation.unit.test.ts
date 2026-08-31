import { describe, expect, test } from 'bun:test';

import { validateWireQueryBatch } from '../../client/query-wire-validation';

describe('validateWireQueryBatch', () => {
  test('rejects non-array wire bodies (corrupt JSON string)', () => {
    expect(() => validateWireQueryBatch('__sim_corrupt__', 1)).toThrow(
      /not array/i
    );
  });

  test('rejects length mismatch', () => {
    expect(() =>
      validateWireQueryBatch([{ status: 'not_modified' }], 2)
    ).toThrow(/length mismatch/i);
  });
});
