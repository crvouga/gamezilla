/**
 * A space the app can't reach: a host's device still holds a space the
 * product no longer has, as when an environment is rebuilt. The product
 * forgets the space without telling anyone's device, so the device keeps
 * listing it; returning to it, the space's room never answers.
 */

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import sql from '@pkgs/sql-root-shared-ts/sql';

function spaceIdOf(link: string): string {
  const id = link.slice('/space/'.length);
  if (!link.startsWith('/space/') || id.length === 0) {
    throw new Error(`not a space link: ${link}`);
  }
  return id;
}

/**
 * The product loses the space at `link` and everything that records who is
 * in it. Nothing is passed on, so every device that held the space keeps
 * its copy. This is the world changing, never something a person does, so
 * it removes the stored rows outright rather than ending the space.
 */
export const forgetSpace = scenarioAction({
  name: 'forgetSpace',
  act: async (s, link: string) => {
    const spaceId = spaceIdOf(link);
    const db = s.harness.serverSql.sqlClient;
    await db.run(
      sql`DELETE FROM spaces_open_sessions WHERE space_id = ${spaceId}`
    );
    await db.run(sql`DELETE FROM spaces_users WHERE space_id = ${spaceId}`);
    await db.run(sql`DELETE FROM spaces WHERE id = ${spaceId}`);
  },
});

/** Press Try again on the screen saying the space can't be reached. */
export const tryReachingSpaceAgain = scenarioAction({
  name: 'tryReachingSpaceAgain',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.spaceUnreachableRetry).tap();
  },
});
