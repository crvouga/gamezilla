// goal:social:3
// goal:social:4
import { describe, expect, test } from 'bun:test';
import {
  leaveUsernameEditor,
  openProfileEdit,
  submitUsername,
  typeUsernameDraft,
} from '@libs/profile/sim/profile-actions';
import {
  readProfileTabUsername,
  readUsernameSaveFace,
} from '@libs/profile/sim/profile-ui-reads';
import type { OpenSim } from '@libs/sim-harness/open-sim/open-sim';
import { openSim } from './support/open-profile-sim';

/** The actor's username once their profile has loaded. */
function loadedUsername(s: OpenSim, actorId: string): Promise<string | null> {
  return s.until((surf) => readProfileTabUsername(surf, actorId), {
    pred: (name) => name !== null,
  });
}

describe('username rules', () => {
  test('a refused name says why and changes nothing; a good one is kept lower-case', async () => {
    await using s = await openSim('username-refusals');
    const before = await loadedUsername(s, 'alice');
    await s.apply(openProfileEdit, 'alice');

    const refusals: readonly (readonly [string, string])[] = [
      ['ab', 'Username is too short'],
      ['x'.repeat(33), 'Username is too long'],
      ['no spaces!', 'Username can only use letters, numbers, and _'],
      ['fuckface', 'That username is not allowed'],
      // Disguised: leetspeak is matched too.
      ['sh1thead_99', 'That username is not allowed'],
    ];
    for (const [name, reason] of refusals) {
      await s.apply(submitUsername, 'alice', name);
      expect(await s.read(readUsernameSaveFace, 'alice')).toBe(reason);
    }
    await s.apply(leaveUsernameEditor, 'alice');
    expect(await s.read(readProfileTabUsername, 'alice')).toBe(before);

    await s.apply(openProfileEdit, 'alice');
    await s.apply(submitUsername, 'alice', 'Mixed_Case_1');
    expect(await s.read(readUsernameSaveFace, 'alice')).toBe('Saved');
    await s.apply(leaveUsernameEditor, 'alice');
    expect(await s.read(readProfileTabUsername, 'alice')).toBe('mixed_case_1');
  });

  test('a draft left with Cancel is not saved', async () => {
    await using s = await openSim('username-cancel');
    const before = await loadedUsername(s, 'alice');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(typeUsernameDraft, 'alice', 'never_saved');
    await s.apply(leaveUsernameEditor, 'alice');
    expect(await s.read(readProfileTabUsername, 'alice')).toBe(before);
  });

  test('a username belongs to one person, whatever the letter case', async () => {
    await using s = await openSim('username-taken');
    await s.apply(openProfileEdit, 'alice');
    await s.apply(submitUsername, 'alice', 'taken_name');
    expect(await s.read(readUsernameSaveFace, 'alice')).toBe('Saved');

    const before = await loadedUsername(s, 'bob');
    await s.apply(openProfileEdit, 'bob');
    await s.apply(submitUsername, 'bob', 'TAKEN_NAME');
    expect(await s.read(readUsernameSaveFace, 'bob')).toBe('Username is taken');
    await s.apply(leaveUsernameEditor, 'bob');
    // The refused name was applied on bob's device first; it rolls back.
    await s.until((surf) => readProfileTabUsername(surf, 'bob'), {
      pred: (name) => name === before,
      maxMs: 10_000,
    });
  });
});
