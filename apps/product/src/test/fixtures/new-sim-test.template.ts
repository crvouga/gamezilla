/**
 * Template for new system scenarios (`defineAction` + `openSim`).
 *
 * Scenarios stay intent-only: `openSim` + `s.apply(action, actorId, …)`.
 * Committed snapshots exist under `fixtures/snapshots/`; wire them via
 * `openSim(id, { snapshot: '…' })` when restore is ready (scenarios do not yet).
 */

import { describe, test } from 'bun:test';
import { openSpacesTab, returnToTabs, signInWithGoogle } from '../../sim';
import { openSim } from '../setup/open-sim';

describe('example journey', () => {
  test('alice signs up and opens spaces', async () => {
    await using s = await openSim('example-journey');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(openSpacesTab, 'alice');
  });
});
