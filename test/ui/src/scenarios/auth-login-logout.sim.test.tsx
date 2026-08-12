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

describe('auth login → logout', () => {
  test('first login → logout on the account screen', async () => {
    await using sim = await Simulation.open({
      seed: 1,
      startMs: Date.parse('2024-06-01T00:00:00.000Z'),
      system: new ClientSimulationSystem(),
      report: {
        store: reportStore,
        ...(process.env['SIM_REPORT_RUN_ID'] !== undefined
          ? { runId: process.env['SIM_REPORT_RUN_ID'] }
          : {}),
        testId: 'auth-login-logout',
        now: () => wallClock.now(),
        maxFramesPerStep: 1,
        frameIntervalMs: 250,
        publishThrottleMs: 250,
      },
    });
    const alice = await sim.actor('alice');
    await alice.ui.expectVisible(by.role('button', 'Current user'));
    await alice.ui.tap(by.role('button', 'Current user'));
    await alice.ui.expectVisible(by.role('button', 'Sign in'));
    await alice.ui.tap(by.role('button', 'Sign in'));
    await alice.ui.expectVisible(by.text('Sign in with email'));
    await alice.ui.tap(by.text('Sign in with email'));
    await alice.ui.expectVisible(by.text('Need an account? Create one'));
    await alice.ui.tap(by.text('Need an account? Create one'));
    await alice.ui.expectVisible(by.label('Email'));
    await alice.ui.input(by.label('Email'), 'alice@sim.local');
    await alice.ui.input(by.label('Password'), 'sim-password-123');
    await alice.ui.expectVisible(by.role('button', 'Create account'));
    await alice.ui.tap(by.role('button', 'Create account'));
    await alice.ui.expectVisible(by.text('Signed in'));
    await alice.ui.tap(by.text('Done'));
    await alice.ui.expectVisible(by.role('button', 'Sign out'));
    await alice.ui.tap(by.role('button', 'Sign out'));
    await alice.ui.expectVisible(by.text('Sign out?'));
    await alice.ui.tap(by.nth(by.role('button', 'Sign out'), 1));
    await alice.ui.expectVisible(by.text('Signed out'));
  });
});
