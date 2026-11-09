import { afterEach, expect, test } from 'bun:test';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { cleanup, screen } from '@solidjs/testing-library';
import { renderUi } from './render';

afterEach(cleanup);

test('the narrowest inset is marked for its sub-360px rule and leaves the fixed insets alone', () => {
  renderUi(
    () => (
      <GameScreen
        screenId="precision"
        title="Connect Four"
        compactInset="narrowest"
      >
        <span data-testid="workspace">Board workspace</span>
      </GameScreen>
    ),
    { width: 320 }
  );
  const board = screen.getByTestId('workspace');
  expect(board.closest('[data-compact-inset="narrowest"]')).not.toBeNull();
  expect(board.closest('.px-ui-xs')).toBeNull();
  expect(board.closest('.px-ui-lg')).toBeNull();
});

test('narrowest leaves wide screens without an inset and keeps one scroll owner', () => {
  for (const width of [320, 768, 1440]) {
    renderUi(
      () => (
        <EmbeddedScreen screenId="inset" compactInset="narrowest">
          <span data-testid="workspace">Board workspace</span>
        </EmbeddedScreen>
      ),
      { width }
    );
    const board = screen.getByTestId('workspace');
    expect(board.closest('[data-compact-inset="narrowest"]') !== null).toBe(
      width < 1024
    );
    expect(document.querySelectorAll('.scroll')).toHaveLength(1);
    cleanup();
  }
});

test('a fill screen under narrowest takes the media-scoped class, not a fixed inset', () => {
  renderUi(
    () => (
      <EmbeddedScreen screenId="inset" compactInset="narrowest" fill>
        <span data-testid="workspace">Board workspace</span>
      </EmbeddedScreen>
    ),
    { width: 320 }
  );
  const host = screen.getByTestId('workspace').parentElement;
  expect(host?.className).toMatch(/narrowest/);
  expect(host?.classList.contains('px-ui-xs')).toBe(false);
  expect(host?.classList.contains('px-ui-lg')).toBe(false);
});
