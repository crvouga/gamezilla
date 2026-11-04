import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { DiscDropBoard } from '@pkgs/ui-root-client-ts/disc-drop-board';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, type JSX, Show } from 'solid-js';
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

// regression: connect-four-columns-say-nothing
test('the board says what to do and marks where the disc would be let go', () => {
  const view = example();
  const board = view.getByRole('group', { name: 'Drop board' });
  const prompt = document.getElementById(
    requiredAttribute(board, 'aria-describedby')
  );
  expect(prompt?.textContent).toBe('Choose a column');
  const marker = (column: HTMLElement) =>
    column.querySelector('[data-disc][aria-hidden="true"]');
  // Every open column carries a chevron; the full one carries nothing.
  const full = view.getByRole('button', { name: 'Column 1, 3 discs, full' });
  const second = view.getByRole('button', { name: 'Column 2, 0 discs' });
  expect(full.querySelector('svg')).toBeNull();
  expect(second.querySelector('svg')).not.toBeNull();
  expect(marker(second)).toHaveAttribute('data-disc', '0');
  // Focusing a column colors its chevron as the dropping side and puts
  // that side's ghost disc where it would land.
  fireEvent.focus(second);
  expect(marker(second)).toHaveAttribute('data-disc', '1');
  const landing = board.querySelector('[data-cell="1"]');
  expect(landing).toHaveAttribute('data-preview-disc', '1');
  expect(landing?.textContent).toBe('●');
  // A board that takes no drop has no chevrons and no prompt, but keeps
  // the prompt's line so the board never moves.
  view.setInteractive(false);
  expect(second.querySelector('svg')).toBeNull();
  expect(board.hasAttribute('aria-describedby')).toBe(false);
  expect(board.querySelector('[data-testid$="-prompt"]')).not.toBeNull();
  view.unmount();
});

/** A 4×3 board drawn directly, with `prompt` as given (left out: nobody is to move). */
function bareBoard(options: {
  readonly prompt?: string | undefined;
  readonly preview?: boolean | undefined;
}) {
  const board = (): JSX.Element => (
    <DiscDropBoard
      cells={[1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]}
      columns={4}
      rows={3}
      active={1}
      winning={[]}
      interactive={options.prompt !== undefined && options.prompt !== ''}
      label="Drop board"
      prompt={options.prompt}
      testId="bare-board"
      columnTestId={(column) => `bare-column-${column + 1}`}
      cellLabel={(column, row) => `Column ${column + 1}, row ${row + 1}`}
      columnLabel={(column) => `Column ${column + 1}`}
      onDrop={() => undefined}
    />
  );
  return render(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <Show when={options.preview === true} fallback={board()}>
        <GameBoardStage preview previewLabel="Board preview">
          {board()}
        </GameBoardStage>
      </Show>
    </ThemeProvider>
  ));
}

/** The numbers heading the columns, left to right. */
function columnNumbers(root: ParentNode): readonly string[] {
  return [...root.querySelectorAll('button[data-column]')].map(
    (column) =>
      column.querySelector('[data-disc][aria-hidden="true"]')?.textContent ?? ''
  );
}

// regression: connect-four-columns-unnumbered
test('every column is headed by its number, as the record writes its moves', () => {
  const view = bareBoard({ prompt: 'Choose a column' });
  expect(columnNumbers(view.container)).toEqual(['1', '2', '3', '4']);
  // On the person's turn the number carries the drop chevron under it.
  const second = view.getByTestId('bare-column-2');
  expect(second.querySelector('svg')).not.toBeNull();
  view.unmount();
});

// regression: setup-preview-reserves-turn-rows
test('a board nobody is to move on, or a setup preview, reserves no turn rows', () => {
  const over = bareBoard({});
  // Over: the numbers stay, but no prompt line and no chevron band.
  expect(over.queryByTestId('bare-board-prompt')).toBeNull();
  expect(columnNumbers(over.container)).toEqual(['1', '2', '3', '4']);
  expect(
    over
      .getByTestId('bare-column-1')
      .querySelectorAll(':scope > [aria-hidden="true"] > span')
  ).toHaveLength(1);
  over.unmount();
  // Someone else to move: the prompt's line keeps its height, empty.
  const waiting = bareBoard({ prompt: '' });
  expect(waiting.getByTestId('bare-board-prompt').textContent).toBe('');
  waiting.unmount();
  // A preview while the game is set up draws only its discs, under its label.
  const preview = bareBoard({ prompt: '', preview: true });
  expect(preview.queryByTestId('bare-board-prompt')).toBeNull();
  expect(
    preview.container.querySelector(
      'button[data-column] > [aria-hidden="true"]'
    )
  ).toBeNull();
  expect(preview.getByText('Board preview')).toBeTruthy();
  preview.unmount();
});
