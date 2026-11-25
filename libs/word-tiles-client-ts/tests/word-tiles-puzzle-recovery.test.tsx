import { expect, test } from 'bun:test';
import { WordTilesPuzzleStatus } from '@libs/word-tiles-client-ts/word-tiles-puzzle-status';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';

// regression: word-tiles-puzzle-unavailable-missing-retry
test('the unavailable puzzle offers recovery and reports loading after retry', () => {
  render(() => {
    const [loading, setLoading] = createSignal(false);
    return (
      <ThemeProvider colorScheme="light">
        <WordTilesPuzzleStatus
          target={20}
          score={null}
          complete={false}
          disabled={false}
          lexicon={
            loading()
              ? { status: 'loading' }
              : { status: 'unavailable', reason: 'offline' }
          }
          onReturnToLibrary={() => undefined}
          onRetryLexicon={() => setLoading(true)}
        />
      </ThemeProvider>
    );
  });
  // The word list's state floats in a toast, outside the render's container,
  // mounted once the render settles.
  flush();
  fireEvent.click(screen.getByRole('button', { name: 'Retry word list' }));
  flush();
  expect(screen.getByRole('status').textContent).toContain(
    'Loading the word list'
  );
  expect(screen.queryByRole('button', { name: 'Retry word list' })).toBeNull();
});
