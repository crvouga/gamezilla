/** @jsxImportSource solid-js */
/**
 * One control panel route shows every Synthetic User in turn: the screen
 * stays mounted while the person moves from one to the next, so nothing a
 * command left on screen for one Synthetic User may follow onto another.
 */
import { afterEach, expect, test } from 'bun:test';
import type { SyntheticUserDetail } from '@libs/synthetic-population-client-ts/synthetic-population-api';
import {
  type SyntheticUserRecord,
  SyntheticUserScreenView,
} from '@libs/synthetic-population-client-ts/synthetic-user-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

const router: AppRouter = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  canGoBack: () => false,
};

/** A Synthetic User as the control panel reads it. */
function syntheticUser(id: string, username: string): SyntheticUserRecord {
  const user: SyntheticUserDetail = {
    id,
    account_id: `account-${username}`,
    username,
    region: 'Berlin, DE',
    paused: false,
    worker_id: 'worker-berlin',
    generation: 3,
    lease_until: '2026-03-14T12:01:00.000Z',
    activity: 'browsing',
    checkpoint: null,
    application_version: '2026.03.14-1',
    last_action: null,
    last_error: null,
    inspection_requested_at: null,
    persona: null,
    created_at: '2026-03-01T09:00:00.000Z',
    updated_at: '2026-03-14T11:59:30.000Z',
    inspection: null,
  };
  return { user, events: [] };
}

const CEDAR = syntheticUser('7d3f0a10-0000-4000-8000-000000000001', 'Cedar');
const MAPLE = syntheticUser('7d3f0a10-0000-4000-8000-000000000002', 'Maple');

function mountControlPanel() {
  const harness = createHarnessClock();
  const [record, setRecord] = createSignal<SyntheticUserRecord>(CEDAR);
  renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SurfaceStackProvider>
          <StaticAppRouterProvider router={router}>
            <SyntheticUserScreenView
              loading={false}
              failed={false}
              record={record()}
              snapshot={null}
              canControl
              onRefresh={() => undefined}
              onCommand={async () => undefined}
              onInspect={async () => undefined}
            />
          </StaticAppRouterProvider>
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return { open: setRecord };
}

// regression: synthetic-user-restart-outcome-follows-to-next
test("a restart's outcome stays with the Synthetic User it was for", async () => {
  const panel = mountControlPanel();
  fireEvent.click(screen.getByTestId('synthetic-population-restart'));
  fireEvent.click(screen.getByTestId('synthetic-population-restart-confirm'));
  await waitFor(() =>
    expect(
      screen.queryByTestId('synthetic-population-restart-done')
    ).not.toBeNull()
  );

  panel.open(MAPLE);

  await waitFor(() =>
    expect(screen.queryByTestId('synthetic-population-restart-done')).toBeNull()
  );
  expect(
    screen.queryByTestId('synthetic-population-restart-confirm')
  ).toBeNull();
});
