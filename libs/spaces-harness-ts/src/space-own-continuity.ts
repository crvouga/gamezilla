import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorLocalSql, deviceMemberIdOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createSpace, openSpaceLink } from './space-actions';
import { readSpaceLink } from './spaces-ui-reads';

/** Keep a locally created space, then return to the space already joined. */
export const prepareOwnSpace = scenarioAction({
  name: 'prepareOwnSpace',
  act: async (s, actorId: string, sharedLink: string) => {
    await Promise.resolve(createSpace.act(s, actorId));
    const ownLink = await readSpaceLink(s, actorId);
    if (ownLink === null) throw new Error('The new space did not open');
    await Promise.resolve(openSpaceLink.act(s, actorId, sharedLink));
  },
});

/** Fixture reference for the person's only own space, after it was created. */
export async function ownSpaceFixtureLink(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  const member = await deviceMemberIdOf(s, actorId);
  const db = actorLocalSql(s, actorId);
  if (db === null || member === null)
    throw new Error('The person has no local identity');
  const rows = await db.query(sql<{ id: string }>`
    SELECT id FROM spaces WHERE (host_member_id = ${member} OR host_account_id = ${member})
      AND ended_at IS NULL AND deleted_at IS NULL
  `);
  if (rows.length !== 1) throw new Error('The fixture needs one own space');
  return `/space/${rows[0]?.id}`;
}

export async function ownSpaceShown(
  s: ProductHarness,
  actorId: string,
  link: string
): Promise<boolean> {
  await bringToFront(s, actorId);
  const ui = await actorUi(s, actorId);
  return (
    (await s.actors.get(actorId)?.currentPath()) === link &&
    (await ui.get(Handles.spaceClose).isVisible())
  );
}
