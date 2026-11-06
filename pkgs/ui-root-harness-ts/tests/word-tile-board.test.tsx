import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import {
  WordTileBoard,
  type WordTileBoardCell,
} from '@pkgs/ui-root-client-ts/word-tile-board';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import WordTileBoardExample from '../../ui-root-client-ts/src/word-tile-board/word-tile-board.example';

function example() {
  const { clock, timers } = createHarnessClock();
  return render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SurfaceStackProvider>
          <WordTileBoardExample />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}

test('squares print their bonus, tiles their letter, and each state is in its label', () => {
  const view = example();
  const board = view.getByRole('group', { name: 'Example word board' });
  expect(board.querySelectorAll('[data-cell]')).toHaveLength(25);
  const start = view.getByRole('button', { name: 'A 1, c3' });
  expect(start.getAttribute('data-state')).toBe('committed');
  expect(
    view.getByRole('button', { name: 'T 1, d3' }).getAttribute('data-state')
  ).toBe('recent');
  expect(view.getByRole('button', { name: '3W, a1, empty' }).textContent).toBe(
    '3W'
  );
  expect(start.getAttribute('aria-disabled')).toBe('true');
});

test('a rack tile placed on a square becomes tentative there and an empty rack slot', () => {
  const view = example();
  fireEvent.click(view.getByRole('button', { name: 'S, 1 point' }));
  expect(
    view
      .getByRole('button', { name: 'S, 1 point' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  fireEvent.click(view.getByRole('button', { name: 'e3, empty' }));
  const placed = view.getByRole('button', { name: 'S 1, e3, tentative' });
  expect(placed.getAttribute('data-state')).toBe('tentative');
  expect(view.getByTestId('example-rack-0').getAttribute('data-placed')).toBe(
    'true'
  );
});

test('arrow keys move focus across squares', () => {
  const view = example();
  const first = view.getByRole('button', { name: 'A 1, c3' });
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(document.activeElement?.getAttribute('data-cell')).toBe('d3');
});

test('the board and rack pass the accessibility audit', () => {
  const view = example();
  const failures = auditTree(view.container);
  expect(failures.map(formatFailure)).toEqual([]);
});

test('the board reads its squares once per change, however a caller computes them', () => {
  let reads = 0;
  const [letter, setLetter] = createSignal('A');
  const cells = (shown: string): readonly WordTileBoardCell[] => {
    reads += 1;
    return Array.from({ length: 9 }, (_, at) => ({
      id: `c${String(at)}`,
      label: `square ${String(at)}`,
      state: at === 4 ? ('committed' as const) : ('empty' as const),
      letter: at === 4 ? shown : '',
      points: at === 4 ? 1 : null,
      square: null,
      enabled: true,
    }));
  };
  const view = render(() => (
    <WordTileBoard
      label="Counted board"
      testId="counted"
      columnLabels={['a', 'b', 'c']}
      rowLabels={['1', '2', '3']}
      cells={cells(letter())}
      squareText={(square) => square}
    />
  ));
  expect(reads).toBe(1);
  setLetter('B');
  expect([reads, view.getByTestId('counted-cell-c4').textContent]).toEqual([
    2,
    'B 1',
  ]);
});

// regression: word-tiles-enlarged-context-loss
test('enlargement retains all squares in an overview and announces the chosen mode', () => {
  const view = example();
  const enlarge = view.getByRole('button', { name: 'Enlarge board' });
  fireEvent.click(enlarge);
  expect(enlarge.getAttribute('aria-pressed')).toBe('true');
  const overview = view.getByRole('img', {
    name: 'Whole board overview; outline shows the enlarged area',
  });
  expect(overview.querySelectorAll('[data-state]')).toHaveLength(25);
  const indicator = overview.querySelector('[data-viewport-indicator]');
  expect(indicator).not.toBeNull();
  const viewport = view.getByRole('region', { name: 'Scrollable word board' });
  Object.defineProperties(viewport, {
    scrollWidth: { value: 800 },
    scrollHeight: { value: 800 },
    clientWidth: { value: 320 },
    clientHeight: { value: 260 },
    scrollLeft: { value: 240 },
    scrollTop: { value: 320 },
  });
  fireEvent.scroll(viewport);
  expect(indicator?.getAttribute('x')).toBe('1.5');
  expect(indicator?.getAttribute('y')).toBe('2');
  expect(indicator?.getAttribute('width')).toBe('2');
  expect(indicator?.getAttribute('height')).toBe('1.625');
  fireEvent.click(view.getByRole('button', { name: 'Fit board' }));
  expect(view.queryByRole('img')).toBeNull();
  expect(enlarge.getAttribute('aria-pressed')).toBe('false');
});

// regression: word-tiles-overview-unreadable-context
test('board map locates a committed intersection without placing the selected rack tile', () => {
  const view = example();
  fireEvent.click(view.getByRole('button', { name: 'S, 1 point' }));
  fireEvent.click(view.getByRole('button', { name: 'Enlarge board' }));
  fireEvent.click(
    view.getByRole('button', { name: 'Board map: locate a square' })
  );
  const locator = view.getByRole('group', { name: 'Whole board locator' });
  const cell = locator.querySelector<HTMLButtonElement>('[data-cell="c3"]');
  expect(cell?.getAttribute('aria-disabled')).toBe('false');
  expect(cell?.textContent).toContain('A');
  if (!cell) throw new Error('Missing locator intersection');
  fireEvent.click(cell);
  expect(view.queryByRole('dialog')).toBeNull();
  const original = view.getByRole('button', { name: 'A 1, c3' });
  expect(document.activeElement).toBe(original);
  expect(view.getByTestId('example-rack-0').getAttribute('data-placed')).toBe(
    'false'
  );
});
