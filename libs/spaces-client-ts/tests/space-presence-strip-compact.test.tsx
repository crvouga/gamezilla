/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { SpaceChromeTrailingActionBar } from '@libs/spaces-client-ts/space-chrome-action-bar';
import { SpacePresenceStripView } from '@libs/spaces-client-ts/space-presence-strip-view';
import {
  AVERY,
  faces,
  GUESTS,
} from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

afterEach(cleanup);

function renderStrip(compact: boolean): HTMLElement {
  const { container } = renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width: 390, height: 640 }}>
      <SpacePresenceStripView
        faces={faces([AVERY, ...GUESTS])}
        size={36}
        compact={compact}
      />
    </ThemeProvider>
  ));
  return container;
}

test('on a phone the members button is the people glyph and how many are here', () => {
  const container = renderStrip(true);
  expect(container.querySelector('[data-component="AvatarGroup"]')).toBeNull();
  const badge = container.querySelector(
    '[data-component="BadgedIcon"] [data-component="Badge"]'
  );
  expect(badge?.textContent).toBe(String(1 + GUESTS.length));
});

test('wide, the members button is everyone’s faces', () => {
  const container = renderStrip(false);
  expect(
    container.querySelector('[data-component="AvatarGroup"]')
  ).not.toBeNull();
  expect(container.querySelector('[data-component="BadgedIcon"]')).toBeNull();
});

// regression: phone-members-count-missing-from-name
test('on a phone the members button names the count it shows', () => {
  const people = [AVERY, ...GUESTS];
  const harness = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 640 }}
      >
        <SpaceChromeTrailingActionBar
          shownCount={people.length}
          canRename={false}
          canEnd={false}
          presence={(size) => (
            <SpacePresenceStripView faces={faces(people)} size={size} compact />
          )}
          callbacks={{
            onPressHome: () => undefined,
            onPressBack: null,
            onPressMembers: () => undefined,
            onPressShare: () => undefined,
            onPressRename: () => undefined,
            onPressEnd: () => undefined,
            onPressLeave: () => undefined,
          }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  const button = container.querySelector(
    `[data-testid="${Handles.spaceMembersButton}"]`
  );
  expect(button?.getAttribute('aria-label')).toBe(
    `${people.length} people in this space`
  );
});
