/**
 * Profile's monkey step: rename. The name is drawn per step and carries the
 * actor id, so two actors in one walk never race for the same username. A
 * rename can legitimately be refused — usernames have a change cooldown — so
 * the step accepts any outcome a person could see on the save button, and
 * fails only when the save never resolves to one.
 */

import { pollUntil } from '@libs/sim-harness/system/actor-ui';
import { visible, walkAction } from '@libs/sim-harness/system/walk-action';
import { Handles } from '@libs/test-ids';

import { openProfileEdit } from './profile-actions';

const WAIT_MS = 10_000;

/** What the save button says once a rename is settled. */
const SETTLED_SAVE_FACES = [
  'Saved',
  'Username was changed recently',
  'Username is taken',
];

export const walkRenameSelf = walkAction({
  name: 'walkRenameSelf',
  applies: async (step) =>
    (await visible(step, Handles.tabProfile)) &&
    !(await visible(step, Handles.spaceClose)),
  act: async ({ s, actorId, ui, pick }) => {
    await Promise.resolve(openProfileEdit.act(s, actorId));
    await ui.get(Handles.profileEditUsername).tap();
    const input = ui.get(Handles.profileUsernameInput);
    await input.expect.visible();
    await input.clear();
    await input.input(`${actorId}_w${String(Math.floor(pick * 1_000_000))}`);
    await ui.get(Handles.profileUsernameSave).tap();
    await pollUntil(
      s,
      async () => {
        const face = (await ui.get(Handles.profileUsernameSave).text()) ?? '';
        return SETTLED_SAVE_FACES.includes(face.trim()) ? face : null;
      },
      { maxMs: WAIT_MS, description: 'username save settled' }
    );
    await ui.get(Handles.profileUsernameCancel).tap();
    await ui.get(Handles.profileEditUsername).expect.visible();
    await ui.get(Handles.navBack).tap();
    await ui.get(Handles.profileEdit).expect.visible();
  },
});

export const PROFILE_WALK_ACTIONS = [walkRenameSelf];
