/**
 * Copy into `test/ui/src/scenarios/<name>.sim.test.tsx` and fill in the journey.
 *
 * Lives under `fixtures/` so depcruise allows fixture imports without naming
 * this file `*.sim.test.ts` (which would pull it into `ci:sim-determinism`).
 *
 * Scenarios stay intent-only: `openSim` + `AppDriver` + fixtures. No `by.*`,
 * no `@pkgs/ui-testing` imports (Biome + `ci:dst-selector-discipline`).
 */

import { describe, test } from '@jest/globals';

import { AppDriver } from '../drivers/app-driver';
import { openSim } from '../setup/open-sim';
import { aliceCreds } from './fixtures';

describe('example journey', () => {
  test('sign up then assert signed-out after logout', async () => {
    await using sim = await openSim('example-journey');
    const app = await AppDriver.forActor(sim, 'alice');
    await app.auth.signUpWithEmail(aliceCreds);
    await app.auth.signOut();
    await app.auth.expectSignedOut();
  });
});
