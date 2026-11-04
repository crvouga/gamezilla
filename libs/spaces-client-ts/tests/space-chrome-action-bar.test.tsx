/** @jsxImportSource solid-js */
/** What the space's top bar offers on a phone and beside the sidebar. */

import { afterEach, expect, test } from 'bun:test';
import {
  SpaceChromeLeadingActionBar,
  SpaceChromeTrailingActionBar,
} from '@libs/spaces-client-ts/space-chrome-action-bar';
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

const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 800 };

const CALLBACKS = {
  onPressHome: () => undefined,
  onPressBack: () => undefined,
  onPressMembers: () => undefined,
  onPressShare: () => undefined,
  onPressRename: () => undefined,
  onPressEnd: () => undefined,
  onPressLeave: () => undefined,
};

function renderBar(
  layout: { width: number; height: number },
  canEnd: boolean
): HTMLElement {
  const harness = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={layout}>
        <SpaceChromeLeadingActionBar {...CALLBACKS} backLabel="Games" />
        <SpaceChromeTrailingActionBar
          canRename
          canEnd={canEnd}
          presence={(size) => (
            <SpacePresenceStripView
              faces={faces([AVERY, ...GUESTS])}
              size={size}
            />
          )}
          callbacks={{ ...CALLBACKS, backLabel: 'Games' }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

function byHandle(container: HTMLElement, handle: string): Element | null {
  return container.querySelector(`[data-testid="${handle}"]`);
}

test('beside the sidebar Close, Back and End space say what they do in words', () => {
  const container = renderBar(WIDE, true);
  expect(byHandle(container, Handles.spaceClose)?.textContent).toContain(
    'Close'
  );
  expect(byHandle(container, Handles.navBack)?.textContent).toContain('Games');
  expect(byHandle(container, Handles.spaceEnd)?.textContent).toContain(
    'End space'
  );
});

test('on a phone Close and Back are glyphs named for what they do', () => {
  const container = renderBar(PHONE, true);
  expect(
    byHandle(container, Handles.spaceClose)?.getAttribute('aria-label')
  ).toBe('Close');
  expect(byHandle(container, Handles.navBack)?.getAttribute('aria-label')).toBe(
    'Games'
  );
});

// End is never parked in ⋯ by policy: the host's way to end the space stays
// on the bar wherever the bar has room for it.
test('the host is offered End on the bar on every size', () => {
  expect(byHandle(renderBar(PHONE, true), Handles.spaceEnd)).not.toBeNull();
  cleanup();
  expect(byHandle(renderBar(WIDE, true), Handles.spaceEnd)).not.toBeNull();
});

test('a guest is offered Leave on the bar, and no End', () => {
  const container = renderBar(WIDE, false);
  expect(byHandle(container, Handles.spaceLeave)?.textContent).toContain(
    'Leave space'
  );
  expect(byHandle(container, Handles.spaceEnd)).toBeNull();
});

test('the members button draws no ring of its own around the faces', () => {
  const container = renderBar(WIDE, true);
  expect(
    byHandle(container, Handles.spaceMembersButton)?.getAttribute(
      'data-variant'
    )
  ).toBe('faces');
});
