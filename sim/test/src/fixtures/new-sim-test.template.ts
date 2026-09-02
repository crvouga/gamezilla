/**
 * Template for new system scenarios (`AppDriver` + `openSim`).
 *
 * Scenarios stay intent-only: `openSim` + `AppDriver.forActor`. No `by.*` selectors.
 * Committed snapshots exist under `fixtures/snapshots/`; wire them via
 * `openSim(id, ctx, { snapshot: '…' })` when restore is ready (scenarios do not yet).
 */

import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('example journey', (ctx) => {
  ctx.test('alice signs up and opens spaces', async () => {
    await using sim = await openSim('example-journey', ctx);
    const app = await AppDriver.forActor(sim, 'alice');
    await app.auth.signInWithDev(aliceCreds);
    await app.auth.returnToTabs();
    await app.space.openTab();
  });
});
