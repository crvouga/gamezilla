/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { ContentAttemptScreenView } from '@libs/game-puzzle-client-ts/content-attempt-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

// regression: puzzle-solved-way-on-moves-pack-card
test("a solved pack puzzle's way on sits in its pack card, not the command row", () => {
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <ContentAttemptScreenView
        status="ready"
        attempt={{
          id: 'attempt-1',
          sourceId: 'revision-1',
          packRevisionId: 'pack-1',
          title: 'Two crates',
          difficulty: 'Easy',
          description: 'Push each crate onto a goal.',
        }}
        pack={{ title: 'Warehouse basics', position: 3, total: 4 }}
        playtest={false}
        saving={false}
        changeError={null}
        complete
        rulesChanged={false}
        unopenable={false}
        player={<span>board</span>}
        controls={<span data-testid="controls">Undo Redo Restart</span>}
        packActions={<span data-testid="next">Next puzzle: Lift</span>}
        onRetryChange={() => undefined}
        onReturnToLibrary={() => undefined}
      />
    </ThemeProvider>
  ));
  const panel = screen.getByTestId('puzzle-attempt-panel');
  expect(panel.contains(screen.getByTestId('next'))).toBe(true);
  expect(screen.getByTestId('controls').textContent).toBe('Undo Redo Restart');
});
