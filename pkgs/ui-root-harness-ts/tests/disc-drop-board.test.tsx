import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import GameArenaExample from '../../ui-root-client-ts/src/game-board-stage/game-arena.example';

function requiredAttribute(element: Element, name: string): string {
  const value = element.getAttribute(name);
  if (value === null) throw new Error(`Missing ${name}`);
  return value;
}
function example() {
  const { clock, timers } = createHarnessClock();
  const [interactive, setInteractive] = createSignal(true);
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <GameArenaExample boardInteractive={interactive()} />
      </ThemeProvider>
    </ClockProvider>
  ));
  return { ...view, setInteractive };
}
test('column controls expose occupancy, preserve gravity, and keep full columns inert', () => {
  const view = example();
  const board = view.getByRole('group', { name: 'Drop board' });
  expect(board.querySelectorAll('[data-cell]')).toHaveLength(12);
  expect(
    board.querySelector('[data-cell="0"]')?.getAttribute('data-testid')
  ).toBe(`${board.getAttribute('data-testid')}-cell-0`);
  const full = view.getByRole('button', { name: 'Column 1, 3 discs, full' });
  expect(full.getAttribute('aria-disabled')).toBe('true');
  expect(
    document.getElementById(requiredAttribute(full, 'aria-describedby'))
      ?.textContent
  ).toContain('Column 1, row 2: Diamond');
  fireEvent.click(full);
  expect(JSON.parse(requiredAttribute(board, 'data-cells'))).toEqual([
    1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0,
  ]);
  fireEvent.click(view.getByRole('button', { name: 'Column 2, 0 discs' }));
  expect(
    (JSON.parse(requiredAttribute(board, 'data-cells')) as number[])[1]
  ).toBe(1);
  fireEvent.click(view.getByRole('button', { name: 'Column 2, 1 discs' }));
  expect(
    (JSON.parse(requiredAttribute(board, 'data-cells')) as number[])[5]
  ).toBe(2);
  view.unmount();
});
test('focus and pointer previews identify the landing cell; navigation wraps and read-only controls refuse actions', () => {
  const view = example();
  const board = view.getByRole('group', { name: 'Drop board' });
  const second = view.getByRole('button', { name: 'Column 2, 0 discs' });
  fireEvent.focus(second);
  expect(board.getAttribute('data-preview-cell')).toBe('1');
  fireEvent.keyDown(second, { key: 'End' });
  expect(document.activeElement).toBe(
    view.getByRole('button', { name: 'Column 4, 0 discs' })
  );
  fireEvent.keyDown(view.getByRole('button', { name: 'Column 4, 0 discs' }), {
    key: 'ArrowRight',
  });
  expect(document.activeElement).toBe(
    view.getByRole('button', { name: 'Column 1, 3 discs, full' })
  );
  fireEvent.pointerEnter(second);
  expect(board.getAttribute('data-preview-cell')).toBe('1');
  view.setInteractive(false);
  expect(second.getAttribute('aria-disabled')).toBe('true');
  expect(board.getAttribute('data-preview-cell')).toBe('-1');
  fireEvent.click(second);
  expect(
    (JSON.parse(requiredAttribute(board, 'data-cells')) as number[])[1]
  ).toBe(0);
  view.unmount();
});

test("a column control's own text says nothing its name leaves out", () => {
  // regression: disc-drop-board-label-not-in-name
  const view = example();
  const board = view.getByRole('group', { name: 'Drop board' });
  expect(
    auditTree(board)
      .map(formatFailure)
      .filter((failure) => failure.startsWith('2ee8b8'))
  ).toEqual([]);
  view.unmount();
});
