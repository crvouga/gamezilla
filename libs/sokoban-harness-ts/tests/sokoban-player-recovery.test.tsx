import { expect, test } from 'bun:test';
import { SokobanPlayerView as SokobanPlayer } from '@libs/sokoban-client-ts/sokoban-player';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

const CORNER = JSON.stringify({
  format: 1,
  rows: ['######', '# $@.#', '#    #', '######'],
});
const rules = sokobanPuzzleContent.rules;
function initial(definition: string): string {
  const result = rules.initial(definition);
  if (!result.accepted) throw new Error('Invalid fixture');
  return result.state;
}
function fixture(definition = CORNER) {
  const [state, setState] = createSignal(
    definition === '{}' ? '' : initial(definition)
  );
  const destinations: unknown[] = [];
  const time = createHarnessClock();
  const view = renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SokobanPlayer
          onReturnToLibrary={() => destinations.push('library')}
          definition={definition}
          state={state()}
          disabled={false}
          onAction={(action) => {
            const next = rules.apply(definition, state(), action);
            if (!next.accepted) throw new Error('Refused action sent');
            setState(next.state);
          }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  return { view, state, setState, destinations };
}

// regression: sokoban-history-stale-refusal
test('Undo, Redo and Restart positions invalidate a refusal from the previous position', () => {
  const { view, state, setState } = fixture();
  const start = state();
  const board = view.getByTestId('sokoban-board');
  const key = (key: string) => fireEvent.keyDown(board, { key });
  key('ArrowLeft');
  const cornered = state();
  key('ArrowLeft');
  expect(view.queryByTestId('sokoban-refusal')).not.toBeNull();
  setState(start); // Undo the corner push.
  expect(view.queryByTestId('sokoban-refusal')).toBeNull();
  key('ArrowUp'); // Refusal at the restored position.
  expect(view.queryByTestId('sokoban-refusal')).not.toBeNull();
  setState(cornered); // Redo must clear that refusal too.
  expect(view.queryByTestId('sokoban-refusal')).toBeNull();
  key('ArrowLeft');
  expect(view.queryByTestId('sokoban-refusal')).not.toBeNull();
  setState(start); // Restart from the blocked corner.
  expect(view.queryByTestId('sokoban-refusal')).toBeNull();
});

// regression: sokoban-unreadable-library-action
test('an unreadable puzzle invokes its library navigation callback', () => {
  const { view, destinations } = fixture('{}');
  fireEvent.click(view.getByRole('button', { name: 'Return to puzzles' }));
  expect(destinations).toEqual(['library']);
});

// regression: sokoban-solved-library-action
// regression: sokoban-solved-below-controls
test('solving offers library navigation before movement controls and still permits moves', () => {
  const { view, destinations } = fixture(
    JSON.stringify({ format: 1, rows: ['#@$ .'] })
  );
  const board = view.getByTestId('sokoban-board');
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  const solved = view.getByTestId('sokoban-solved');
  expect(
    solved.compareDocumentPosition(view.getByTestId('sokoban-move')) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).not.toBe(0);
  fireEvent.click(view.getByRole('button', { name: 'More puzzles' }));
  expect(destinations).toEqual(['library']);
  fireEvent.keyDown(board, { key: 'ArrowLeft' });
  expect(view.getByTestId('sokoban-counts').getAttribute('data-moves')).toBe(
    '3'
  );
});
