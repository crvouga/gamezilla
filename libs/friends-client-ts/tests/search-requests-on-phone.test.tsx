/** @jsxImportSource solid-js */
/**
 * The friend requests waiting reach the person on every size: a desktop
 * lists them in the column beside the search, a phone has an entry to them
 * under the search field.
 */
import { afterEach, expect, test } from 'bun:test';
import { SearchScreenView } from '@libs/search-client-ts/search-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const router: AppRouter = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  canGoBack: () => false,
};

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/** The search with what the friends sub fills its slots with. */
function renderSearch(
  size: { width: number; height: number },
  query = 'jor'
): HTMLElement {
  const harness = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider colorScheme="light" fixedLayout={size}>
        <StaticAppRouterProvider router={router}>
          <TestViewportProvider value={size}>
            <SearchScreenView
              query={query}
              recentQueries={[]}
              search={{
                searching: false,
                needsConnection: false,
                failed: false,
                results: [],
              }}
              renderUserRow={() => null}
              aside={<span data-testid="requests-column">column</span>}
              requests={<span data-testid="requests-entry">entry</span>}
              onQueryChange={() => undefined}
              onSelectRecent={() => undefined}
              onClearRecent={() => undefined}
            />
          </TestViewportProvider>
        </StaticAppRouterProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

// regression: search-phone-hides-friend-requests
test('a phone shows the friend requests entry under the search field', () => {
  const container = renderSearch(PHONE);
  const entry = screen.getByTestId('requests-entry');
  const controls = container.querySelector(
    '[data-component="CollectionControls"]'
  );
  expect(controls?.contains(entry)).toBe(true);
  expect(screen.queryByTestId('requests-column')).toBe(null);
});

test('a desktop lists them in the column instead, never twice', () => {
  renderSearch(DESKTOP);
  expect(screen.getByTestId('requests-column')).toBeTruthy();
  expect(screen.queryByTestId('requests-entry')).toBe(null);
});

// regression: search-long-query-empty-heading-overflow
test('a long search remains editable without being repeated in the empty heading', () => {
  const query = 'a_really_long_username_that_keeps_going_and_going';
  renderSearch(PHONE, query);
  expect(screen.getByRole('textbox', { name: 'Search people' })).toHaveValue(
    query
  );
  expect(
    screen.getByText('No people found', { exact: true })
  ).toBeInTheDocument();
  expect(screen.queryByText(`No people found for “${query}”`)).toBeNull();
  expect(
    screen.getByText('Check the spelling or try a different username.')
  ).toBeInTheDocument();
});
