import { CustomGamesAttr } from '@libs/chess-custom-game-shared/custom-game-state';
import type { ProductHarness } from '@libs/harness/harness';
import sql from '@pkgs/sql-shared/sql';

/** The acknowledged game record, also retained when its space has ended. */
export function readStoredCustomGames(s: ProductHarness, spaceId: string) {
  const state = s.harness.roomNode.inspect(`space:${spaceId}`)?.committedState;
  if (state === undefined)
    throw new Error(`no acknowledged room for ${spaceId}`);
  return CustomGamesAttr.from(state);
}

/** The committed game and independently stored space membership for Alloy. */
export async function readStoredCustomGameWorld(
  s: ProductHarness,
  spaceId: string
) {
  const spaces = await s.harness.serverSql.sqlClient.query(
    sql<{
      host_member_id: string | null;
      host_account_id: string | null;
      ended_at: string | null;
    }>`SELECT host_member_id, host_account_id, ended_at FROM spaces WHERE id = ${spaceId} AND deleted_at IS NULL`
  );
  const space = spaces[0];
  if (space === undefined) throw new Error(`no stored space ${spaceId}`);
  const members = await s.harness.serverSql.sqlClient.query(
    sql<{
      user_id: string;
    }>`SELECT user_id FROM spaces_users WHERE space_id = ${spaceId} AND deleted_at IS NULL`
  );
  return {
    games: readStoredCustomGames(s, spaceId),
    host:
      space.ended_at === null
        ? (space.host_member_id ?? space.host_account_id)
        : null,
    members: members.map((row) => row.user_id),
  };
}
