import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import {
  createSpace,
  selectChessGame,
} from '@libs/spaces-harness/space-actions';
import sql from '@pkgs/sql-root-shared/sql';

export async function multiplayerSpaceId(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const id = await signedInAccountOf(s, actor);
  if (id === null) throw new Error('Multiplayer actor has no bound identity');
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    id: string;
  }>`SELECT s.id FROM spaces AS s
    LEFT JOIN spaces_users AS u ON u.space_id = s.id AND u.user_id = ${id} AND u.deleted_at IS NULL
    WHERE (s.host_member_id = ${id} OR u.id IS NOT NULL) AND s.ended_at IS NULL AND s.deleted_at IS NULL ORDER BY s.id`);
  const path = await s.actors.get(actor)?.currentPath();
  const current = path?.match(/\/space\/([^/?]+)/)?.[1];
  return rows.find((row) => row.id === current)?.id ?? rows[0]?.id ?? null;
}

/** Given setup: supply the space required for all multiplayer play. */
export const givenMultiplayerSpace = scenarioAction({
  name: 'givenMultiplayerSpace',
  act: async (s, actor: string) => {
    let id = await multiplayerSpaceId(s, actor);
    if (id === null) {
      await Promise.resolve(createSpace.act(s, actor));
      id = await multiplayerSpaceId(s, actor);
    } else await s.actors.get(actor)!.openLink(`/space/${id}`);
    const ui = await actorUi(s, actor);
    if (await ui.get('game-menu-chess').isVisible())
      await Promise.resolve(selectChessGame.act(s, actor));
    await s.session.waitForIdle();
  },
});
