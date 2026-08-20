import { describe, expect, test } from 'bun:test';

import { buildPaginationWindow } from './build-pagination-window';

describe('buildPaginationWindow', () => {
  test('empty when pageCount is zero', () => {
    expect(buildPaginationWindow(0, 0, 1)).toEqual([]);
  });

  test('lists every page when count is small', () => {
    expect(buildPaginationWindow(2, 5, 1)).toEqual([
      { type: 'page', pageIndex: 0 },
      { type: 'page', pageIndex: 1 },
      { type: 'page', pageIndex: 2 },
      { type: 'page', pageIndex: 3 },
      { type: 'page', pageIndex: 4 },
    ]);
  });

  test('windows around current with ellipsis on both sides', () => {
    expect(buildPaginationWindow(5, 12, 1)).toEqual([
      { type: 'ellipsis', id: 'start' },
      { type: 'page', pageIndex: 4 },
      { type: 'page', pageIndex: 5 },
      { type: 'page', pageIndex: 6 },
      { type: 'ellipsis', id: 'end' },
    ]);
  });

  test('omits leading ellipsis near start', () => {
    expect(buildPaginationWindow(0, 12, 1)).toEqual([
      { type: 'page', pageIndex: 0 },
      { type: 'page', pageIndex: 1 },
      { type: 'ellipsis', id: 'end' },
    ]);
  });

  test('omits trailing ellipsis near end', () => {
    expect(buildPaginationWindow(11, 12, 1)).toEqual([
      { type: 'ellipsis', id: 'start' },
      { type: 'page', pageIndex: 10 },
      { type: 'page', pageIndex: 11 },
    ]);
  });
});
