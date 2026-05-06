import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';

export async function loadMemberOfSpaceIds(
  db: PatchDb,
  myId: string
): Promise<string[]> {
  const ids = new Set<string>();

  const [hosted] = await db.read(
    [
      {
        entityType: SPACE_ENTITY_TYPE,
        where: {
          type: 'and',
          clauses: [
            { type: '=', attribute: SpaceAttr.hostId, value: myId },
            { type: 'not_exists', attribute: SpaceAttr.endedAt },
          ],
        },
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  for (const e of hosted?.entities ?? []) {
    ids.add(e.entityId);
  }

  const [guestMem] = await db.read(
    [
      {
        entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
        where: {
          type: 'and',
          clauses: [
            { type: '=', attribute: SpaceMembershipAttr.guestId, value: myId },
            { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt },
          ],
        },
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  for (const e of guestMem?.entities ?? []) {
    const sid = e.attributes[SpaceMembershipAttr.spaceId];
    if (typeof sid === 'string' && sid.length > 0) ids.add(sid);
  }

  return [...ids];
}
