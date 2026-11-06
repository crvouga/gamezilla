/** @jsxImportSource solid-js */
/**
 * The lobby's groups are titled like every page's sections, and on a phone
 * the list ends clear of the floating "New space".
 */
import { afterEach, expect, test } from 'bun:test';
import { SpacesScreenView } from '@libs/spaces-client-ts/spaces-screen-view';
import { LOBBY_SPACES } from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { floatingActionClearance } from '@pkgs/ui-root-client-ts/floating-action-clearance';
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

function mount(size: { width: number; height: number }): HTMLElement {
  const time = createHarnessClock();
  return renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={size}>
        <StaticAppRouterProvider router={router}>
          <TestViewportProvider value={size}>
            <SpacesScreenView
              status="ready"
              hostedCount={2}
              spaces={LOBBY_SPACES}
              onCreateSpace={() => Promise.resolve()}
              onOpenSpace={() => undefined}
            />
          </TestViewportProvider>
        </StaticAppRouterProvider>
      </ThemeProvider>
    </ClockProvider>
  )).container;
}

// regression: lobby-group-labels-weak — "Hosting 2 spaces" and "Shared with
// you" were 12px muted eyebrows over the cards, weaker than any other
// page's section titles. They are section headings at the subtitle size
// "Needs you" and "Who's here" use, on the page's own edge.
test('the lobby titles its groups as headings on phone and desktop', () => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 1200, height: 884 },
  ]) {
    mount(size);
    const hosting = screen.getByTestId(Handles.spacesHostingCount);
    expect(hosting.tagName).toBe('H2');
    expect(hosting.textContent).toBe('Hosting 2 spaces');
    expect(hosting.className).toContain('textSubtitle');
    const shared = screen.getByRole('heading', { name: 'Shared with you' });
    expect(shared.tagName).toBe('H2');
    expect(shared.className).toContain('textSubtitle');
    cleanup();
  }
});

// regression: lobby-last-card-under-new-space — on a phone the floating
// "New space" sits over the list's end: the list keeps room for it after
// its last card, so the last space scrolls fully clear.
test('on a phone the lobby ends with room for the floating New space', () => {
  const container = mount({ width: 390, height: 844 });
  const clearance = container.querySelector(
    '[data-component="FloatingActionClearance"]'
  ) as HTMLElement | null;
  expect(clearance).not.toBeNull();
  expect(clearance?.style.height).toBe(`${floatingActionClearance(0)}px`);
  const cards = [
    ...container.querySelectorAll('[data-testid^="space-lobby-card"]'),
  ];
  const last = cards.at(-1) ?? null;
  expect(last).not.toBeNull();
  expect(
    (last as Element).compareDocumentPosition(clearance as Node) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});
