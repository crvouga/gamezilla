import { expect, test } from 'bun:test';
import { NumberlinkBoard } from '@libs/numberlink-client-ts/numberlink-board';
import { DENSE_NUMBERLINK } from '@libs/numberlink-client-ts/numberlink-extremes.example';
import type { NumberlinkState } from '@libs/numberlink-shared-ts/numberlink-types';
import { createSignal } from 'solid-js';
import { renderNumberlink } from './numberlink-client-fixture';

function rowPath(row: number, length: number) {
  return {
    pairId: `row-${row}`,
    cells: Array.from({ length }, (_, x) => ({ x, y: row })),
  };
}

// regression: numberlink-dense-drawing-rewrites-every-cell
// Each drawing step on a 20 × 20 board relabelled all 400 cells and rebuilt
// every path's SVG node, so sustained drawing at 390px with 4× CPU
// throttling overran its 30 second budget. One step must touch only the
// cell it adds and update the drawn path's existing node in place.
test('extending a path on the densest board rewrites only the cell it adds', () => {
  const finished = Array.from({ length: 19 }, (_, row) => rowPath(row + 1, 20));
  const [state, setState] = createSignal<NumberlinkState>({
    paths: [...finished, rowPath(0, 5)],
  });
  const view = renderNumberlink(() => (
    <NumberlinkBoard definition={DENSE_NUMBERLINK} state={state()} />
  ));
  try {
    const board = view.getByTestId('numberlink-board');
    const before = [...board.querySelectorAll('polyline')];
    const observer = new MutationObserver(() => undefined);
    observer.observe(board, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-label'],
    });
    setState({ paths: [...finished, rowPath(0, 6)] });
    const relabelled = observer
      .takeRecords()
      .filter((record) => record.type === 'attributes')
      .map((record) => (record.target as Element).getAttribute('aria-label'));
    observer.disconnect();
    expect(relabelled).toEqual(['F1: path 1, unfinished']);
    const after = [...board.querySelectorAll('polyline')];
    expect(after.length).toBe(before.length);
    expect(after.every((node, index) => node === before[index])).toBe(true);
  } finally {
    view.unmount();
  }
});
