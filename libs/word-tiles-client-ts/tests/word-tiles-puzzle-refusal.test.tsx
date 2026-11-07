import { expect, test } from 'bun:test';
import {
  CAT_AND_TOE,
  STORY_LEXICON,
  STORY_LEXICON_KEY,
} from '@libs/word-tiles-client-ts/word-tiles-board-view.example';
import { WordTilesPuzzlePlayerView } from '@libs/word-tiles-client-ts/word-tiles-puzzle-player-view';
import { encodePuzzle } from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { RULESET } from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { IdProvider } from '@pkgs/uuid-client-ts/solid';
import { fireEvent } from '@solidjs/testing-library';

// regression: word-tiles-puzzle-refusal-unemphasized
test('TOEEA is a grouped refusal with recall restoring the retained rack', () => {
  const moves: string[] = [];
  const view = render(() => (
    <IdProvider createId={() => 'puzzle'} random={() => 0.5}>
      <ThemeProvider colorScheme="light">
        <WordTilesPuzzlePlayerView
          definition={encodePuzzle({
            ruleset: RULESET.id,
            lexicon: STORY_LEXICON_KEY,
            board: CAT_AND_TOE,
            rack: 'AEST?RN',
            target: 20,
          })}
          state={JSON.stringify({ v: 1, played: null, score: null })}
          disabled={false}
          lexicon={STORY_LEXICON}
          onAction={(action) => moves.push(action)}
          onRetryLexicon={() => undefined}
          onReturnToLibrary={() => undefined}
        />
      </ThemeProvider>
    </IdProvider>
  ));
  for (const [tile, cell] of [
    ['17', 'i11'],
    ['0', 'i12'],
  ]) {
    fireEvent.click(view.getByTestId(`word-tiles-puzzle-rack-${tile}`));
    fireEvent.click(view.getByTestId(`word-tiles-puzzle-cell-${cell}`));
  }
  expect(view.getByRole('alert').textContent).toContain(
    'Not in the word list: TOEEA'
  );
  expect(view.getByRole('alert').textContent).toContain('Recall tiles');
  expect(
    view.getByTestId('word-tiles-puzzle-submit').hasAttribute('disabled')
  ).toBe(true);
  fireEvent.click(view.getByTestId('word-tiles-puzzle-recall'));
  expect(view.queryByRole('alert')).toBeNull();
  expect(
    view.getByTestId('word-tiles-puzzle-rack-17').hasAttribute('disabled')
  ).toBe(false);
  expect(
    view.getByTestId('word-tiles-puzzle-rack-0').hasAttribute('disabled')
  ).toBe(false);
  expect(moves).toEqual([]);
});
