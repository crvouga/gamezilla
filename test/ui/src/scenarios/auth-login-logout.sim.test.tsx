import { setTimeout as nodeSetTimeout } from 'node:timers/promises';
import { describe, expect, jest, test } from '@jest/globals';
import { wallClock } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { openSimulation, type Simulation } from '@pkgs/simulation';
import { resolveLocalReportDataDir } from '@pkgs/simulation-report';
import {
  by,
  type Driver,
  formatSelector,
  nth,
  type Selector,
} from '@pkgs/ui-testing';

import { createClientSimulationSystem } from '../harness/create-client-simulation-system';

const reportStore = createNodeFsObjectStore({
  rootDir: resolveLocalReportDataDir(),
});

/**
 * Wall delay that cannot be swallowed by Jest fake timers (expo-router /
 * RNTL occasionally re-enable them). Uses `node:timers/promises` after
 * forcing real timers so poll loops always make progress.
 */
async function realDelay(ms: number): Promise<void> {
  jest.useRealTimers();
  await nodeSetTimeout(ms);
}

function realNow(): number {
  jest.useRealTimers();
  return Date.now();
}

/** Default UI presence budget — fail fast; override only for slow I/O. */
const UI_WAIT_MS = 10_000;
/** Create-account / session round-trip can exceed the UI budget. */
const AUTH_WAIT_MS = 30_000;

async function waitVisible(
  sim: Simulation,
  driver: Driver,
  target: Selector,
  timeoutMs = UI_WAIT_MS
): Promise<void> {
  await sim.step(`wait ${formatSelector(target)}`, async () => {
    const deadline = realNow() + timeoutMs;
    let lastText = '';
    while (realNow() < deadline) {
      jest.useRealTimers();
      if (await driver.isVisible(target)) return;
      lastText = (await driver.getText(target).catch(() => null)) ?? lastText;
      await realDelay(50);
    }
    throw new Error(
      `Timed out waiting for ${JSON.stringify(target)} (${lastText})`
    );
  });
}

async function tapWhenVisible(
  sim: Simulation,
  driver: Driver,
  target: Selector,
  timeoutMs = UI_WAIT_MS
): Promise<void> {
  await waitVisible(sim, driver, target, timeoutMs);
  await driver.tap(target);
}

describe('auth login → logout', () => {
  test('first login → logout on the account screen', async () => {
    const sim = await openSimulation({
      seed: 1,
      // Recent fixed epoch so auth/session expiry math isn't relative to 1970.
      startMs: Date.parse('2024-06-01T00:00:00.000Z'),
      system: createClientSimulationSystem(),
      report: {
        store: reportStore,
        ...(process.env['SIM_REPORT_RUN_ID'] !== undefined
          ? { runId: process.env['SIM_REPORT_RUN_ID'] }
          : {}),
        testId: 'auth-login-logout',
        now: () => wallClock.now(),
      },
    });
    try {
      const alice = await sim.actor('alice');
      await alice.open('/more/account');

      // Anon boot + sync hydration lands the account screen (fresh install).
      await waitVisible(sim, alice.ui, by.role('button', 'Sign in'));

      // Open sign-in modal → email → create account.
      await tapWhenVisible(sim, alice.ui, by.role('button', 'Sign in'));
      await tapWhenVisible(sim, alice.ui, by.text('Sign in with email'));
      await tapWhenVisible(
        sim,
        alice.ui,
        by.text('Need an account? Create one')
      );

      await waitVisible(sim, alice.ui, by.label('Email'));
      await alice.ui.typeText(by.label('Email'), 'alice@sim.local');
      await alice.ui.typeText(by.label('Password'), 'sim-password-123');
      await tapWhenVisible(sim, alice.ui, by.role('button', 'Create account'));

      await waitVisible(sim, alice.ui, by.text('Signed in'), AUTH_WAIT_MS);
      await tapWhenVisible(sim, alice.ui, by.text('Done'));

      // Account row opens the confirm modal; modal submit is the 2nd Sign out button.
      await tapWhenVisible(sim, alice.ui, by.role('button', 'Sign out'));
      await waitVisible(sim, alice.ui, by.text('Sign out?'));
      await tapWhenVisible(
        sim,
        alice.ui,
        nth(by.role('button', 'Sign out'), 1)
      );

      await waitVisible(sim, alice.ui, by.text('Signed out'), AUTH_WAIT_MS);
      expect(await alice.ui.isVisible(by.text('Signed out'))).toBe(true);
    } finally {
      await sim.dispose();
    }
  }, 60_000);
});
