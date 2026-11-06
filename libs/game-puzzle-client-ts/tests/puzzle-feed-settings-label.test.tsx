/** @jsxImportSource solid-js */
/** The puzzle feed's settings control says what it is. */

import { afterEach, expect, test } from 'bun:test';
import { PuzzleFeedBarView } from '@libs/game-puzzle-client-ts/puzzle-feed-bar-view';
import { DEFAULT_PUZZLE_FEED_CONFIG } from '@libs/game-puzzle-shared-ts/feed-config';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

// regression: puzzle-feed-settings-unlabelled — on a phone the puzzle
// feed's settings were a small sliders icon with no words, far below the
// board. The control now says "Settings" beside its icon.
test('the feed bar names its settings in words beside the icon', () => {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width: 390, height: 844 }}>
      <PuzzleFeedBarView
        puzzleId="chess/00a3f"
        rating={1702}
        themes={['mate']}
        ratingChange={null}
        config={DEFAULT_PUZZLE_FEED_CONFIG}
        configReady
        effectiveRating={1500}
        matched={10}
        total={20}
        allowanceLabel=""
        themeLabel={(theme) => theme}
        onOpenFeedSettings={() => undefined}
      />
    </ThemeProvider>
  ));
  const label = screen.getByTestId('chess-puzzle-feed-settings-label');
  expect(label.textContent).toBe('Settings');
  expect(screen.getByTestId('chess-puzzle-feed-summary').contains(label)).toBe(
    true
  );
});
