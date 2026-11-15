/**
 * A search this device refuses itself (another game is still on) fails the
 * command as a server refusal does, so its button never says it was accepted.
 */

import { expect, test } from 'bun:test';
import { useRefusals } from '@libs/game-matchmaking-client-ts/use-multiplayer-controls';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { createRoot } from 'solid-js';

// regression: refused-search-reads-accepted — a search refused on this device
// set the refusal and resolved, so Find an opponent turned green with
// "Opponent search accepted" under "Finish your Custom Game first".
test('a refusal made on this device is shown and fails the command', () => {
  createRoot((dispose) => {
    const refusals = useRefusals();
    const decision = { allowed: false, reason: 'restricted' } as Decision;
    expect(() => refusals.refuse(decision)).toThrow('Refused: restricted');
    expect(refusals.denial()).toBe(decision);
    dispose();
  });
});
