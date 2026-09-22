// goal:social:3
import { describe, expect, test } from 'bun:test';
import {
  openAvatarEditor,
  openProfileEdit,
} from '@libs/profile/sim/profile-actions';
import {
  readAvatarSeed,
  readProfileTabUsername,
} from '@libs/profile/sim/profile-ui-reads';
import { openSim } from './support/open-profile-sim';

const VALID_USERNAME = /^[a-z0-9_]{3,32}$/i;

describe('profile defaults', () => {
  test('a first-time guest already has a username and an avatar of their own', async () => {
    await using s = await openSim('profile-defaults');
    const hasName = { pred: (name: string | null) => name !== null };
    const alice = await s.until(
      (surf) => readProfileTabUsername(surf, 'alice'),
      hasName
    );
    const bob = await s.until(
      (surf) => readProfileTabUsername(surf, 'bob'),
      hasName
    );
    expect(alice).toMatch(VALID_USERNAME);
    expect(bob).toMatch(VALID_USERNAME);
    expect(alice).not.toBe(bob);

    await s.apply(openProfileEdit, 'alice');
    await s.apply(openAvatarEditor, 'alice');
    expect(await s.read(readAvatarSeed, 'alice')).not.toBe('');
  });
});
