import { join } from 'node:path';
import { setTimeout as nodeSetTimeout } from 'node:timers/promises';
import { describe, expect, jest, test } from '@jest/globals';
import { wallClock } from '@pkgs/clock';
import { openSimulation, type Simulation } from '@pkgs/simulation';
import {
  by,
  type Driver,
  formatSelector,
  nth,
  type Selector,
} from '@pkgs/ui-testing';

import { createClientSimulationSystem } from '../harness/create-client-simulation-system';

const REPORT_OUT_DIR = join(
  process.cwd(),
  'simulation-report',
  'auth-login-logout'
);

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

async function waitVisible(
  sim: Simulation,
  driver: Driver,
  target: Selector,
  timeoutMs = 90_000
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
  target: Selector
): Promise<void> {
  await waitVisible(sim, driver, target);
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
        outDir: REPORT_OUT_DIR,
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

      await waitVisible(sim, alice.ui, by.text('Signed in'));
      await tapWhenVisible(sim, alice.ui, by.text('Done'));

      // Account row opens the confirm modal; modal submit is the 2nd Sign out button.
      await tapWhenVisible(sim, alice.ui, by.role('button', 'Sign out'));
      await tapWhenVisible(
        sim,
        alice.ui,
        nth(by.role('button', 'Sign out'), 1)
      );

      await waitVisible(sim, alice.ui, by.text('Signed out'));
      expect(await alice.ui.isVisible(by.text('Signed out'))).toBe(true);
    } finally {
      await sim.dispose();
    }
  }, 180_000);
});
