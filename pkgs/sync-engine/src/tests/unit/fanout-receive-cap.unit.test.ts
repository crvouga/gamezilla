import { describe, expect, test } from 'bun:test';

import { rowsWithinReceiveCap } from '../../client/attach-push-rows-cap';
import { MAX_FANOUT_ROWS } from '../../queries/shared/bounds';

describe('fanout receive cap', () => {
  test('accepts rows within MAX_FANOUT_ROWS', () => {
    const rows: Record<string, { id: string }[]> = {
      notes: Array.from({ length: MAX_FANOUT_ROWS }, (_, i) => ({
        id: `n${i}`,
      })),
    };
    expect(rowsWithinReceiveCap(rows)).toEqual(rows);
  });

  test('drops rows over MAX_FANOUT_ROWS', () => {
    const rows: Record<string, { id: string }[]> = {
      notes: Array.from({ length: MAX_FANOUT_ROWS + 1 }, (_, i) => ({
        id: `n${i}`,
      })),
    };
    expect(rowsWithinReceiveCap(rows)).toBeUndefined();
  });
});
