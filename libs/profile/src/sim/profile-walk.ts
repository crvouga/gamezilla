/**
 * Profile's monkey step: rename. The name is drawn per step and carries the
 * actor id, so two actors in one walk never race for the same username. A
 * rename can legitimately be refused — usernames have a change cooldown — so
 * the step accepts any outcome a person could see on the save button, and
 * fails only when the save never resolves to one.
 */

import { pollUntil } from '@libs/sim-harness/system/actor-ui';
import { actorLocalSql } from '@libs/sim-harness/system/identity';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { visible, walkAction } from '@libs/sim-harness/system/walk-action';
import { Handles } from '@libs/test-ids';
import { sql } from '@pkgs/sql';

import { openProfileEdit } from './profile-actions';

const WAIT_MS = 10_000;

/** What the save button says once a rename is settled. */
const SETTLED_SAVE_FACES = [
  'Saved',
  'Username was changed recently',
  'Username is taken',
];

async function savedUsernameMatches(
  s: ProductSim,
  actorId: string,
  username: string
) {
  const db = actorLocalSql(s, actorId);
  if (db === null) return false;
  const rows = await db.query(sql<{ username: string }>`
    SELECT username FROM profile
    WHERE username = ${username} AND deleted_at IS NULL
  `);
  return rows.length === 1;
}

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
    const username = `${actorId}_w${String(Math.floor(pick * 1_000_000))}`;
    await input.input(username);
    await ui.get(Handles.profileUsernameSave).tap();
    let lastFace = '';
    await pollUntil(
      s,
      async () => {
        const face = (await ui.get(Handles.profileUsernameSave).text()) ?? '';
        lastFace = face;
        if (SETTLED_SAVE_FACES.includes(face.trim())) return face;
        // Saved is transient. If the virtual clock has already cleared it,
        // require the persisted name before accepting the idle button.
        if (
          face.trim() === 'Save' &&
          (await savedUsernameMatches(s, actorId, username))
        ) {
          return 'Saved';
        }
        if (!['', 'Save', 'Saving…'].includes(face.trim())) {
          throw new Error(`Unexpected username save outcome: ${face}`);
        }
        return null;
      },
      {
        maxMs: WAIT_MS,
        get description() {
          return `username save settled (last face: ${lastFace})`;
        },
      }
    );
    await ui.get(Handles.profileUsernameCancel).tap();
    await ui.get(Handles.profileEditUsername).expect.visible();
    await ui.get(Handles.navBack).tap();
    await ui.get(Handles.profileEdit).expect.visible();
  },
});

export const PROFILE_WALK_ACTIONS = [walkRenameSelf];
