import { afterEach, expect, test } from 'bun:test';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { cleanup, screen } from '@solidjs/testing-library';
import { renderUi } from './render';

afterEach(cleanup);

// regression: word-tiles-320-precision-width-clipped
test('compact precision screens opt in to a four-pixel inset through the game shell', () => {
  renderUi(
    () => (
      <GameScreen screenId="precision" title="Word Tiles" compactInset="narrow">
        <span data-testid="workspace">Board workspace</span>
      </GameScreen>
    ),
    { width: 320 }
  );
  expect(screen.getByTestId('workspace').closest('.px-ui-xs')).not.toBeNull();
  expect(screen.getByTestId('workspace').closest('.px-ui-lg')).toBeNull();
});

test('default compact screens retain the standard inset and wide screens retain no inset', () => {
  for (const width of [320, 768, 1440]) {
    for (const narrow of [false, true]) {
      renderUi(
        () => (
          <EmbeddedScreen
            screenId="inset"
            compactInset={narrow ? 'narrow' : 'standard'}
          >
            <span data-testid="workspace">Board workspace</span>
          </EmbeddedScreen>
        ),
        { width }
      );
      const board = screen.getByTestId('workspace');
      expect(board.closest('.px-ui-lg') !== null).toBe(width < 1024 && !narrow);
      expect(board.closest('.px-ui-xs') !== null).toBe(width < 1024 && narrow);
      expect(document.querySelectorAll('.scroll')).toHaveLength(1);
      cleanup();
    }
  }
});

test('nested and fill screens retain a single scrolling owner under the narrow policy', () => {
  for (const kind of ['nested', 'fill'] as const) {
    renderUi(
      () => (
        <EmbeddedScreen
          screenId="inset"
          compactInset="narrow"
          nested={kind === 'nested'}
          fill={kind === 'fill'}
        >
          <span data-testid="workspace">Board workspace</span>
        </EmbeddedScreen>
      ),
      { width: 320 }
    );
    const board = screen.getByTestId('workspace');
    expect(document.querySelectorAll('.scroll')).toHaveLength(0);
    expect(board.closest('.px-ui-xs') !== null).toBe(kind === 'fill');
    expect(board.closest('.px-ui-lg')).toBeNull();
    cleanup();
  }
});
