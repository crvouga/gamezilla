import { setTimeout as nodeSetTimeout } from 'node:timers/promises';
import { describe, expect, jest, test } from '@jest/globals';
import { openSimulation } from '@pkgs/simulation';
import { by, type Driver, nth, type Selector } from '@pkgs/ui-testing';

import { createClientSimulationSystem } from '../harness/create-client-simulation-system';

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
  driver: Driver,
  target: Selector,
  timeoutMs = 90_000
): Promise<void> {
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
  }, 180_000);
});
