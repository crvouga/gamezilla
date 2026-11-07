import { expect, test } from 'bun:test';
import { WordTilesPuzzleStatus } from '@libs/word-tiles-client-ts/word-tiles-puzzle-status';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

// regression: word-tiles-puzzle-unavailable-missing-retry
test('the unavailable puzzle offers recovery and reports loading after retry', () => {
  const view = render(() => {
    const [loading, setLoading] = createSignal(false);
    return (
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
    );
  });
  fireEvent.click(view.getByRole('button', { name: 'Retry word list' }));
  expect(view.getByRole('status').textContent).toContain(
    'Loading the word list'
  );
  expect(view.queryByRole('button', { name: 'Retry word list' })).toBeNull();
});
