import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { DiscDropBoard } from '@pkgs/ui-root-client-ts/disc-drop-board';
import { fireEvent } from '@solidjs/testing-library';

const positions = [
  { history: '000000111111222222433333344444555555666666', winning: [] },
  { history: '0101010', winning: [0, 7, 14, 21] },
];

// regression: connect-four-final-position-dimmed
test('finished disc positions retain full color and refuse further drops', () => {
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../ui-root-client-ts/src/disc-drop-board/disc-drop-board.module.css'
    ),
    'utf8'
  );
  // The browser stories verify computed opacity; this contract catches the
  // original fade without requiring a browser build for the safety suite.
  for (const rule of css.split('}')) {
    if (rule.includes('[data-full=') || rule.includes('[data-won=')) {
      expect(rule).not.toMatch(/opacity\s*:/);
    }
  }
  expect(css).toMatch(/\.cell\[data-winning="true"\]\s*\{[^}]*outline:/);
  for (const position of positions) {
    const cells = Array<number>(42).fill(0);
    const heights = Array<number>(7).fill(0);
    for (const [turn, character] of position.history.split('').entries()) {
      const column = Number(character);
      const row = heights[column] ?? 0;
      cells[row * 7 + column] = (turn % 2) + 1;
      heights[column] = row + 1;
    }
    let drops = 0;
    const view = render(() => (
      <DiscDropBoard
        cells={cells}
        columns={7}
        rows={6}
        active={1}
        winning={position.winning}
        interactive={false}
        label="Finished Connect Four"
        testId="finish"
        columnTestId={(column) => `finish-column-${column}`}
        cellLabel={(column, row, disc) => `${column}, ${row}: ${disc}`}
        columnLabel={(column) => `Column ${column + 1}`}
        onDrop={() => {
          drops++;
        }}
      />
    ));
    expect(
      view.container.querySelectorAll('[data-winning="true"]')
    ).toHaveLength(position.winning.length);
    expect(
      view.container.querySelectorAll('[data-cell]:not([data-disc="0"])')
    ).toHaveLength(position.history.length);
    for (const column of view.getAllByRole('button')) {
      expect(column).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(column);
    }
    expect(drops).toBe(0);
    expect(view.getByTestId('finish')).toHaveAttribute(
      'data-cells',
      JSON.stringify(cells)
    );
    view.unmount();
  }
});
