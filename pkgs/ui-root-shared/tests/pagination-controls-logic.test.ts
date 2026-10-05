import { describe, expect, test } from 'bun:test';
import type { PaginationWindowItem } from '@pkgs/ui-root-shared/build-pagination-window';
import {
  buildPaginationWindow,
  paginationWindowItemKey,
} from '@pkgs/ui-root-shared/build-pagination-window';

const pages = (items: readonly PaginationWindowItem[]) =>
  items.map((i) => (i.type === 'page' ? i.pageIndex : `…${i.id}`));

describe('buildPaginationWindow', () => {
  test('empty for zero pages', () => {
    expect(buildPaginationWindow(0, 0, 1)).toEqual([]);
  });

  test('lists every page when the count fits the window', () => {
    expect(pages(buildPaginationWindow(0, 5, 1))).toEqual([0, 1, 2, 3, 4]);
    expect(pages(buildPaginationWindow(2, 3, 0))).toEqual([0, 1, 2]);
  });

  test('windows around the current page with ellipses', () => {
    expect(pages(buildPaginationWindow(5, 20, 1))).toEqual([
      '…start',
      4,
      5,
      6,
      '…end',
    ]);
    expect(pages(buildPaginationWindow(0, 20, 1))).toEqual([0, 1, '…end']);
    expect(pages(buildPaginationWindow(19, 20, 2))).toEqual([
      '…start',
      17,
      18,
      19,
    ]);
  });

  test('clamps out-of-range page index and negative siblings', () => {
    expect(pages(buildPaginationWindow(99, 10, 1))).toEqual(['…start', 8, 9]);
    expect(pages(buildPaginationWindow(-4, 10, -3))).toEqual([0, '…end']);
  });

  test('keys are stable and unique', () => {
    const items = buildPaginationWindow(5, 20, 1);
    const keys = items.map(paginationWindowItemKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('ellipsis-start');
    expect(keys).toContain('page-5');
  });
});
