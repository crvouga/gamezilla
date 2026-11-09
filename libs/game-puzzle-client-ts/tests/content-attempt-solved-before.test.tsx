/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { ContentAttemptScreenView } from '@libs/game-puzzle-client-ts/content-attempt-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(complete: boolean, solvedBefore: boolean): void {
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
        complete={complete}
        solvedBefore={solvedBefore}
        rulesChanged={false}
        unopenable={false}
        player={<span>board</span>}
        onRetryChange={() => undefined}
        onReturnToLibrary={() => undefined}
      />
    </ThemeProvider>
  ));
}

// regression: puzzle-completion-banner-under-unsolved-board
test('a restarted puzzle keeps its saved completion quietly, not the full banner', () => {
  mount(false, true);
  expect(screen.queryByTestId('content-attempt-complete')).toBeNull();
  expect(screen.getByTestId('content-attempt-solved-before').textContent).toBe(
    'Solved before. Your completion stays saved.'
  );
});

test('a solved board shows the full completion and not the quiet note', () => {
  mount(true, true);
  expect(screen.getByTestId('content-attempt-complete')).toBeTruthy();
  expect(screen.queryByTestId('content-attempt-solved-before')).toBeNull();
});
