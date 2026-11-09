import { afterEach, expect, test } from 'bun:test';
import { SokobanPlayerView } from '@libs/sokoban-client-ts/sokoban-player';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

type PlayContext = Parameters<typeof SokobanPlayerView>[0]['context'];

function unreadable(context?: PlayContext): HTMLElement {
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <SokobanPlayerView
        onReturnToLibrary={() => undefined}
        context={context}
        definition="{}"
        state=""
        disabled={false}
        onAction={() => undefined}
      />
    </ThemeProvider>
  ));
  return screen.getByTestId('sokoban-unreadable');
}

// regression: sokoban-unreadable-exit-unnamed
test("an unreadable pack puzzle names the pack card's Pack overview as its way out", () => {
  const notice = unreadable({ kind: 'pack', shellOffersWayOn: true });
  expect(notice.textContent).toBe(
    'This puzzle cannot be opened. Choose another from Pack overview.'
  );
  expect(screen.queryByRole('button', { name: 'More puzzles' })).toBeNull();
});

test('an unreadable playtest sends the author back to the builder', () => {
  expect(
    unreadable({ kind: 'playtest', shellOffersWayOn: true }).textContent
  ).toBe('This draft cannot be opened. Go back to the builder to fix it.');
});

test('a puzzle on its own keeps its own way out', () => {
  expect(unreadable().textContent).toContain('Choose another puzzle.');
  expect(
    screen.getByRole('button', { name: 'More puzzles' })
  ).toBeInTheDocument();
});
