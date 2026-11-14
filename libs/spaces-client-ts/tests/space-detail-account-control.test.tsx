/** @jsxImportSource solid-js */
/** The space's bar on a phone keeps the account control whole. */

import { afterEach, expect, test } from 'bun:test';
import { SpaceDetailScreenView } from '@libs/spaces-client-ts/space-detail-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

afterEach(cleanup);

// regression: space-bar-account-squeezed — with a long game name in the
// phone's bar, the account control was a shrinkable item of the bar's row
// and was squeezed to a sliver at the screen's edge; the name now gives
// way and the control keeps its size.
test("on a phone the account control never shrinks for a long game's name", () => {
  const harness = createHarnessClock();
  const view = renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width: 390, height: 844 }}>
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <SurfaceStackProvider>
          <AppFrameChromeProvider
            globalTrailing={
              <button type="button" data-testid="account">
                Account
              </button>
            }
          >
            <SpaceDetailScreenView
              title="Friday game night"
              place="Connect Four: the extended tournament edition"
              status="ready"
              hostOffline={false}
              canRename
              canEnd
              onPressHome={() => undefined}
              onPressBack={() => undefined}
              backLabel="Games"
              onPressMembers={() => undefined}
              onPressShare={() => undefined}
              onPressRename={() => undefined}
              onPressEnd={() => undefined}
              onPressLeave={() => undefined}
            />
          </AppFrameChromeProvider>
        </SurfaceStackProvider>
      </ClockProvider>
    </ThemeProvider>
  ));
  const holder = view.getByTestId('account').parentElement;
  expect(holder?.getAttribute('data-component')).toBe('StackHorizontal');
  expect(holder?.className.split(/\s+/)).not.toContain('shrink');
  view.unmount();
});
