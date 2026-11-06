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

// regression: word-tiles-puzzle-detached-bonus-context
test('AEST?RN at j8 explains the covered triple-letter square beside the rack', () => {
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
          onAction={() => undefined}
          onRetryLexicon={() => undefined}
          onReturnToLibrary={() => undefined}
        />
      </ThemeProvider>
    </IdProvider>
  ));
  const bonus = () => view.getByTestId('word-tiles-puzzle-bonus');
  expect(bonus().textContent).toContain('2L/3L');
  fireEvent.click(view.getByTestId('word-tiles-puzzle-rack-98'));
  view.getByTestId('word-tiles-puzzle-cell-j8').focus();
  fireEvent.click(view.getByTestId('word-tiles-puzzle-cell-j8'));
  // regression: word-tiles-blank-small-targets
  expect(document.activeElement).toBe(
    view.getByTestId('word-tiles-puzzle-blank-A')
  );
  fireEvent.click(view.getByTestId('word-tiles-puzzle-blank-S'));
  expect(document.activeElement).toBe(
    view.getByTestId('word-tiles-puzzle-cell-j8')
  );
  expect(bonus().textContent).toContain('j8: 3L triples this letter');
  expect(bonus().textContent).toContain('Blank tiles score 0');
  expect(view.getByTestId('word-tiles-puzzle-cell-j8').textContent).toContain(
    'S'
  );
  const rack = view.getByTestId('word-tiles-puzzle-rack');
  const board = view.getByTestId('word-tiles-puzzle');
  expect(rack.compareDocumentPosition(bonus()) & 4).toBe(4);
  expect(bonus().compareDocumentPosition(board) & 4).toBe(4);
  fireEvent.click(view.getByTestId('word-tiles-puzzle-recall'));
  expect(bonus().textContent).toContain('2L/3L');
  expect(bonus().textContent).not.toContain('j8:');
  fireEvent.click(view.getByRole('button', { name: 'S, 1 points' }));
  fireEvent.click(view.getByTestId('word-tiles-puzzle-cell-j8'));
  expect(bonus().textContent).toBe('j8: 3L triples this letter.');
});
