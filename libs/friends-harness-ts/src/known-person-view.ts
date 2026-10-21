import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorLocalSql } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import sql from '@pkgs/sql-root-shared-ts/sql';

/** Follow the profile link already known on this device, including offline. */
export async function showKnownPerson(
  s: ProductHarness,
  actorId: string,
  username: string
): Promise<boolean> {
  await actorUi(s, actorId);
  const rows = await actorLocalSql(s, actorId)?.query(
    sql<{
      readonly id: string;
    }>`SELECT id FROM profile WHERE username = ${username} LIMIT 1`
  );
  const id = rows?.[0]?.id;
  if (id === undefined) return false;
  const actor = s.actors.get(actorId)!;
  const path = `/profile/user/${id}`;
  if ((await actor.currentPath()) !== path) await actor.openLink(path);
  await bringToFront(s, actorId);
  return true;
}
