import { describe, expect, test } from '@jest/globals';
import { wallClock, wallTimers } from '@pkgs/clock';
import { openSimulation } from '@pkgs/simulation';
import { by, type Driver, nth, type Selector } from '@pkgs/ui-testing';

import { createClientSimulationSystem } from '../harness/create-client-simulation-system';

/**
 * Polls with wall timers (not the sim clock) so React/async work gets turns
 * between checks. The driver's own `waitFor` advances virtual time in a tight
 * microtask loop, which would starve async I/O.
 *
 * Do not call `act()` between polls — sync act during in-flight Hono/pg-mem
 * work can deadlock the request under Jest + RNTL.
 */
async function realDelay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    wallTimers.setTimeout(resolve, ms);
  });
}

async function waitVisible(
  driver: Driver,
  target: Selector,
  timeoutMs = 90_000
): Promise<void> {
  const deadline = wallClock.now() + timeoutMs;
  let lastText = '';
  while (wallClock.now() < deadline) {
    if (await driver.isVisible(target)) return;
    lastText = (await driver.getText(target).catch(() => null)) ?? lastText;
    await realDelay(50);
  }
  throw new Error(
    `Timed out waiting for ${JSON.stringify(target)} (${lastText})`
  );
}

async function tapWhenVisible(driver: Driver, target: Selector): Promise<void> {
  await waitVisible(driver, target);
  await driver.tap(target);
}

describe('auth login → logout', () => {
  test('first login → logout on the account screen', async () => {
    const sim = await openSimulation({
      seed: 1,
      // Recent fixed epoch so auth/session expiry math isn't relative to 1970.
      startMs: Date.parse('2024-06-01T00:00:00.000Z'),
      system: createClientSimulationSystem(),
      report: true,
    });
    try {
      const alice = await sim.actor('alice');
      await alice.open('/more/account');

      // Anon boot + sync hydration lands the account screen (fresh install).
      await waitVisible(alice.ui, by.role('button', 'Sign in'));

      // Open sign-in modal → email → create account.
      await tapWhenVisible(alice.ui, by.role('button', 'Sign in'));
      await tapWhenVisible(alice.ui, by.text('Sign in with email'));
      await tapWhenVisible(alice.ui, by.text('Need an account? Create one'));

      await waitVisible(alice.ui, by.label('Email'));
      await alice.ui.typeText(by.label('Email'), 'alice@sim.local');
      await alice.ui.typeText(by.label('Password'), 'sim-password-123');
      await tapWhenVisible(alice.ui, by.role('button', 'Create account'));

      await waitVisible(alice.ui, by.text('Signed in'));
      await tapWhenVisible(alice.ui, by.text('Done'));

      // Account row opens the confirm modal; modal submit is the 2nd Sign out button.
      await tapWhenVisible(alice.ui, by.role('button', 'Sign out'));
      await tapWhenVisible(alice.ui, nth(by.role('button', 'Sign out'), 1));

      await waitVisible(alice.ui, by.text('Signed out'));
      expect(await alice.ui.isVisible(by.text('Signed out'))).toBe(true);
    } finally {
      await sim.dispose();
    }
  }, 120_000);
});
