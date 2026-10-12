import { expect, test } from 'bun:test';
import { formatPhaseArg, parsePhaseArg } from './model-phase';

test('a phase argument round-trips and refuses a range outside the model', () => {
  expect(parsePhaseArg('4/12')).toEqual({ indexes: [4], count: 12 });
  expect(parsePhaseArg('0-3,5-11/12')).toEqual({
    indexes: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11],
    count: 12,
  });
  expect(formatPhaseArg([11, 5, 0, 1, 2, 3, 6, 7, 8, 9, 10], 12)).toBe(
    '0-3,5-11/12'
  );
  for (const text of ['', '1', '5-3/12', '1,1/3', '12/12', '0/0', '1/1'])
    expect(parsePhaseArg(text)).toBeNull();
});
