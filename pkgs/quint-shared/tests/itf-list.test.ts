import { expect, test } from 'bun:test';
import { decodeItfValue, quintEqual } from '@pkgs/quint-shared/itf';

test('decodes promotion offers from an ITF list, including nested values', () => {
  // regression: quint-itf-list-values
  expect(decodeItfValue(['q', 'r', 'b', 'n'])).toEqual(['q', 'r', 'b', 'n']);
  expect(
    decodeItfValue([[], { '#bigint': '12' }, { '#tup': ['a', true] }])
  ).toEqual([[], 12, ['a', true]]);
  expect(quintEqual(decodeItfValue(['q', 'r']), ['r', 'q'])).toBe(false);
});
