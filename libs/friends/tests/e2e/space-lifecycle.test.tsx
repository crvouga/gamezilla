// goal:spaces:6
import { describe, expect, test } from 'bun:test';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { aliceUsername } from '@libs/sim-harness/open-sim/fixtures';
import {
  createSpace,
  reenterActiveSpace,
  returnToLobby,
} from '@libs/spaces/sim/space-actions';
import { activeSpaceVisible } from '@libs/spaces/sim/spaces-ui-reads';
import { openSim } from './support/open-friends-sim';

describe('space lifecycle', () => {
  test('the host reopens their live space after returning to the lobby', async () => {
    await using s = await openSim('space-lifecycle-reopen');

    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(returnToLobby, 'alice');
    await s.apply(reenterActiveSpace, 'alice', aliceUsername);
    expect(await s.read(activeSpaceVisible, 'alice')).toBe(true);
  });
});
