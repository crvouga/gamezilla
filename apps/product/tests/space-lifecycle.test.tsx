// goal:spaces:6
import { describe, expect, test } from 'bun:test';
import {
  activeSpaceVisible,
  createSpace,
  reenterActiveSpace,
  returnToLobby,
  returnToTabs,
  signInWithGoogle,
} from '../src/sim';
import { aliceUsername } from '../src/test/fixtures/fixtures';
import { openSim } from '../src/test/setup/open-sim';

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
