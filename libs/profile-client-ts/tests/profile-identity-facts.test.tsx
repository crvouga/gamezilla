/** @jsxImportSource solid-js */
/**
 * A person's own profile says who they are with facts this device knows,
 * beside a small picture: never a hero-sized face echoing the header's.
 */
import { afterEach, expect, test } from 'bun:test';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { ProfileScreenView } from '@libs/profile-client-ts/profile-screen-view';
import { STORY_IDENTITY } from '@libs/profile-client-ts/profile-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
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

/** Time stands still for the screen's clock. */
const STILL = {
  clock: { now: () => Date.parse('2024-01-01T00:00:00.000Z') },
  timers: {
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    setInterval: () => 0,
    clearInterval: () => undefined,
  },
};

function mountProfile(friends: boolean): HTMLElement {
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={STILL.clock} timers={STILL.timers}>
      <ThemeProvider colorScheme="light" fixedLayout={PHONE}>
        <SurfaceStackProvider>
          <StaticAppRouterProvider router={router}>
            <TestViewportProvider value={PHONE}>
              <ModerationProvider rules={shippedModerationRules()}>
                <ProfileScreenView
                  status="ready"
                  identity={STORY_IDENTITY}
                  standInName={null}
                  usernameChange={null}
                  friendsCount={
                    friends ? (
                      <span data-testid={Handles.profileFriendsCount}>11</span>
                    ) : undefined
                  }
                  onEditProfile={() => undefined}
                  onOpenSettings={() => undefined}
                  onChooseUsername={() => undefined}
                  onRetry={() => undefined}
                />
              </ModerationProvider>
            </TestViewportProvider>
          </StaticAppRouterProvider>
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

// regression: profile-identity-holds-no-facts
test('the identity shows how many friends and when they joined', () => {
  mountProfile(true);
  const facts = screen.getByTestId(Handles.profileFacts);
  expect(facts.textContent).toContain('Friends');
  expect(facts.contains(screen.getByTestId(Handles.profileFriendsCount))).toBe(
    true
  );
  expect(facts.textContent).toContain('Joined');
  expect(facts.textContent).toContain('November 2023');
});

test('without a friends sub only the facts it knows: when they joined', () => {
  mountProfile(false);
  const facts = screen.getByTestId(Handles.profileFacts);
  expect(facts.textContent).not.toContain('Friends');
  expect(facts.textContent).toContain('Joined');
});

// regression: profile-phone-avatar-echoes-header
test('on a phone the picture is small, beside the name, not a hero', () => {
  const container = mountProfile(true);
  const avatar = container.querySelector(
    '[data-component="ProfileIdentity"] [data-component="Avatar"]'
  ) as HTMLElement | null;
  expect(avatar).not.toBeNull();
  expect(avatar?.style.width).toBe('64px');
});

// regression: profile-joined-date-outweighs-name
test('the joined date is a quiet caption, not a stat beside the friends count', () => {
  mountProfile(true);
  const facts = screen.getByTestId(Handles.profileFacts);
  const strip = facts.querySelector('[data-component="MetricStrip"]');
  expect(strip?.textContent ?? '').not.toContain('November 2023');
  expect(facts.textContent).toContain('Joined November 2023');
});
