import { describe, expect, test } from 'bun:test';
import { RESET_DB_QUERY_PARAM } from './opfs-recover-url';

describe('RESET_DB_QUERY_PARAM', () => {
  test('is the reset-db escape hatch', () => {
    expect(RESET_DB_QUERY_PARAM).toBe('reset-db');
  });
});
