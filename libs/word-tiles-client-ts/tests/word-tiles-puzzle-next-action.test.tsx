import { expect, test } from 'bun:test';
import { WordTilesPuzzlePlayerView } from '@libs/word-tiles-client-ts/word-tiles-puzzle-player-view';
import { WordTilesPuzzleStatus } from '@libs/word-tiles-client-ts/word-tiles-puzzle-status';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

// regression: word-tiles-puzzle-unreadable-no-destination
test('an unreadable definition offers the puzzle library without a move', () => {
  const destinations: unknown[] = [];
  const moves: string[] = [];
  const view = render(() => (
    <ThemeProvider colorScheme="light">
      <WordTilesPuzzlePlayerView
        definition="{}"
        state=""
        disabled={false}
        lexicon={{ status: 'loading' }}
        onRetryLexicon={() => undefined}
        onAction={(action) => moves.push(action)}
        onReturnToLibrary={() => destinations.push('library')}
      />
    </ThemeProvider>
  ));
  expect(view.getByRole('alert').textContent).toContain(
    'This puzzle cannot be opened'
  );
  fireEvent.click(view.getByRole('button', { name: 'Puzzle library' }));
  expect(destinations).toEqual(['library']);
  expect(moves).toEqual([]);
});

// regression: word-tiles-puzzle-solved-no-next-action
test('the solved eight-point move against target six offers a library action', () => {
  let opened = 0;
  const view = render(() => (
    <ThemeProvider colorScheme="light">
      <WordTilesPuzzleStatus
        target={6}
        score={8}
        complete
        disabled={false}
        lexicon={{ status: 'unavailable', reason: 'offline' }}
        onRetryLexicon={() => {
          throw new Error('Completion must not retry');
        }}
        onReturnToLibrary={() => {
          opened += 1;
        }}
      />
    </ThemeProvider>
  ));
  expect(view.getByTestId('word-tiles-puzzle-complete').textContent).toContain(
    'Puzzle solved'
  );
  fireEvent.click(view.getByRole('button', { name: 'Puzzle library' }));
  expect(opened).toBe(1);
  expect(view.queryByRole('button', { name: 'Retry word list' })).toBeNull();
});
