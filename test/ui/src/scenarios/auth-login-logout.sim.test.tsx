import { describe, expect, test } from '@jest/globals';
import { wallClock } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { Simulation } from '@pkgs/simulation';
import { resolveLocalReportDataDir } from '@pkgs/simulation-report';
import { by } from '@pkgs/ui-testing';

import { ClientSimulationSystem } from '../harness/client-simulation-system';

const reportStore = createNodeFsObjectStore({
  rootDir: resolveLocalReportDataDir(),
});

/** Default UI presence budget — fail fast; override only for slow I/O. */
const UI_WAIT_MS = 10_000;
/** Anon boot + sync paint can exceed the UI budget before chrome appears. */
const BOOT_WAIT_MS = 30_000;
/** Create-account / session round-trip can exceed the UI budget. */
const AUTH_WAIT_MS = 30_000;

describe('auth login → logout', () => {
  test('first login → logout on the account screen', async () => {
    const sim = await Simulation.open({
      seed: 1,
      // Recent fixed epoch so auth/session expiry math isn't relative to 1970.
      startMs: Date.parse('2024-06-01T00:00:00.000Z'),
      system: new ClientSimulationSystem(),
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

      // Home → Account via status-strip Current user (user-visible chrome).
      await alice.ui.expectVisible(by.role('button', 'Current user'), {
        timeoutMs: BOOT_WAIT_MS,
      });
      await alice.ui.tap(by.role('button', 'Current user'));

      // Account screen after anon boot + sync hydration.
      await alice.ui.expectVisible(by.role('button', 'Sign in'), {
        timeoutMs: BOOT_WAIT_MS,
      });

      // Open sign-in modal → email → create account.
      await alice.ui.tap(by.role('button', 'Sign in'));
      await alice.ui.expectVisible(by.text('Sign in with email'), {
        timeoutMs: UI_WAIT_MS,
      });
      await alice.ui.tap(by.text('Sign in with email'));
      await alice.ui.expectVisible(by.text('Need an account? Create one'), {
        timeoutMs: UI_WAIT_MS,
      });
      await alice.ui.tap(by.text('Need an account? Create one'));

      await alice.ui.expectVisible(by.label('Email'), {
        timeoutMs: UI_WAIT_MS,
      });
      await alice.ui.typeText(by.label('Email'), 'alice@sim.local');
      await alice.ui.typeText(by.label('Password'), 'sim-password-123');
      await alice.ui.expectVisible(by.role('button', 'Create account'), {
        timeoutMs: UI_WAIT_MS,
      });
      await alice.ui.tap(by.role('button', 'Create account'));

      await alice.ui.expectVisible(by.text('Signed in'), {
        timeoutMs: AUTH_WAIT_MS,
      });
      await alice.ui.tap(by.text('Done'));

      // Account row opens the confirm modal; modal submit is the 2nd Sign out.
      await alice.ui.expectVisible(by.role('button', 'Sign out'), {
        timeoutMs: UI_WAIT_MS,
      });
      await alice.ui.tap(by.role('button', 'Sign out'));
      await alice.ui.expectVisible(by.text('Sign out?'), {
        timeoutMs: UI_WAIT_MS,
      });
      await alice.ui.tap(by.nth(by.role('button', 'Sign out'), 1));

      await alice.ui.expectVisible(by.text('Signed out'), {
        timeoutMs: AUTH_WAIT_MS,
      });
      expect(await alice.ui.isVisible(by.text('Signed out'))).toBe(true);
    } finally {
      await sim.dispose();
    }
  }, 60_000);
});
