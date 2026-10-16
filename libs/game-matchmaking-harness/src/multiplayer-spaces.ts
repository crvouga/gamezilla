import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import sql from '@pkgs/sql-root-shared/sql';

/**
 * Which space the multiplayer screen belongs to. A signed-out device has no
 * account row; the space it is standing in is still the one on screen, so a
 * later sign-in invitation can show. A signed-in device uses a space it
 * belongs to, preferring the one in the address.
 */
export function spaceIdForActor(
  accountId: string | null,
  membershipIds: readonly string[],
  path: string | undefined
): string | null {
  const current = path?.match(/\/space\/([^/?]+)/)?.[1];
  if (accountId === null) return current ?? null;
  return membershipIds.find((id) => id === current) ?? membershipIds[0] ?? null;
}

export async function multiplayerSpaceId(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const path = await s.actors.get(actor)?.currentPath();
  const id = await signedInAccountOf(s, actor);
  if (id === null) return spaceIdForActor(null, [], path);
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    id: string;
  }>`SELECT s.id FROM spaces AS s
    LEFT JOIN spaces_users AS u ON u.space_id = s.id AND u.user_id = ${id} AND u.deleted_at IS NULL
    WHERE (s.host_member_id = ${id} OR u.id IS NOT NULL) AND s.ended_at IS NULL AND s.deleted_at IS NULL ORDER BY s.id`);
  return spaceIdForActor(
    id,
    rows.map((row) => row.id),
    path
  );
}
