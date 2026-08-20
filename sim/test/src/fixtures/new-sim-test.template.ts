/**
 * Template for new DST scenarios (`AppDriver` + `openSim`).
 *
 * Scenarios stay intent-only: `openSim` + `AppDriver.forActor`. No `by.*` selectors.
 */

import { describe, test } from '@jest/globals';

import { AppDriver } from '../drivers/app-driver';
import { openSim } from '../setup/open-sim';
import { aliceCreds } from './fixtures';

describe('example journey', () => {
  test('sign-up', async () => {
    await using sim = await openSim('example-journey');
    const app = await AppDriver.forActor(sim, 'alice');
    await app.auth.signUpWithEmail(aliceCreds);
  });
});
