/** @jsxImportSource solid-js */

import { renderWithI18n } from '@pkgs/vitest-solid/render';
import { screen } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';
import { VirtualizedList } from './virtualized-list';

describe('VirtualizedList', () => {
  test('renders only the rows that fit the viewport plus overscan', () => {
    renderWithI18n(() => (
      <VirtualizedList
        count={10_000}
        rowHeight={40}
        fixedViewport={{ width: 300, height: 400 }}
        renderRow={(i) => `item-${i}`}
      />
    ));
    const rows = screen.getAllByRole('listitem');
    // 400px / 40px = 10 visible + 2 overscan (only trailing edge at offset 0).
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.length).toBeLessThanOrEqual(13);
    expect(rows[0]).toHaveTextContent('Row 0: item-0');
    expect(rows[0]).toHaveAttribute('data-index', '0');
  });

  test('sizes the spacer to the full virtual height', () => {
    renderWithI18n(() => (
      <VirtualizedList
        count={250}
        rowHeight={20}
        fixedViewport={{ width: 300, height: 100 }}
        renderRow={String}
      />
    ));
    const scroller = screen.getByTestId('virtualized-list');
    const spacer = scroller.firstElementChild as HTMLElement;
    expect(spacer.style.height).toBe('5000px');
  });
});
