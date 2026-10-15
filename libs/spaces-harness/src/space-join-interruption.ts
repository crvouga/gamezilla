import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { deviceMemberIdOf } from '@libs/harness/identity';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';
import sql from '@pkgs/sql-root-shared/sql';
import { openSpaceLink } from './space-actions';

/** Hold delivery after healthy reads; joining must not infer acceptance from those reads. */
export const askToJoinWithoutAnswer = scenarioAction({
  name: 'askToJoinWithoutAnswer',
  act: (s, actorId: string, link: string) =>
    heldJoin(s, { actorId, link, admitted: false }),
});

export const askToJoinAfterAdmission = scenarioAction({
  name: 'askToJoinAfterAdmission',
  act: (s, actorId: string, link: string) =>
    heldJoin(s, { actorId, link, admitted: true }),
});

async function heldJoin(
  s: ProductHarness,
  input: { actorId: string; link: string; admitted: boolean }
): Promise<void> {
  const { actorId, link, admitted } = input;
  await Promise.resolve(openSpaceLink.act(s, actorId, link));
  const barrier = s.harness.net.holdHttp(actorId, '/api/mutations', {
    admitted,
  });
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.spaceJoin).tap({ timeoutMs: 15_000 });
  await pollUntil(
    s,
    async () => (barrier.requestsStarted() > 0 ? true : null),
    {
      maxMs: 5_000,
      description: 'join submitted without an answer',
    }
  );
}

/** Server fact for an admitted-request fault; it is never used as UI confirmation. */
export async function joinAcceptedOnServer(
  s: ProductHarness,
  actor: string,
  link: string
): Promise<boolean> {
  const member = await deviceMemberIdOf(s, actor);
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    joined: boolean;
  }>`SELECT joined FROM spaces_users
    WHERE space_id = ${link.slice('/space/'.length)} AND user_id = ${member} AND deleted_at IS NULL`);
  return rows[0]?.joined === true;
}

export async function joinUnconfirmedShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  await bringToFront(s, actorId);
  const ui = await actorUi(s, actorId);
  const text = await ui.get(Handles.spaceJoin).text();
  return text?.includes('Not confirmed') === true;
}

export async function lobbyShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  await bringToFront(s, actorId);
  const ui = await actorUi(s, actorId);
  return (
    (await ui.get(Handles.spacesListReady).isVisible()) &&
    !(await ui.get(Handles.spaceJoinPrompt).isVisible()) &&
    !(await ui.get(Handles.spaceClose).isVisible())
  );
}

/** Current membership is claimed by the live-space dock as well as the full space. */
export async function joinClaimShown(
  s: ProductHarness,
  actorId: string,
  link: string
): Promise<boolean> {
  await bringToFront(s, actorId);
  const spaceId = /^\/space\/([^/?#]+)/.exec(link)?.[1];
  if (spaceId === undefined) throw new Error(`Not a space link: ${link}`);
  const ui = await actorUi(s, actorId);
  const join = ui.get(Handles.spaceJoin);
  return (
    (await ui.get(Handles.spaceMiniplayerOpen(spaceId)).isVisible()) ||
    ((await join.isVisible()) && (await join.text()) === 'Joined') ||
    ((await s.actors.get(actorId)?.currentPath()) === link &&
      (await ui.get(Handles.spaceClose).isVisible()))
  );
}
