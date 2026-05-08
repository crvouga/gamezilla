import { spaceGuestMembershipEntityId } from '@gamezilla/domain/spaces/membership-key';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { mergePlain } from '@gamezilla/lib/merge-plain';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { useCallback } from 'react';

import { useMyId } from '@gamezilla/client/auth/auth-context';

function isoNow(): string {
  return new Date().toISOString();
}

async function readSpaceHostId(
  db: PatchDb,
  spaceId: string
): Promise<string | null> {
  const [res] = await db.read([
    { entityType: SPACE_ENTITY_TYPE, entityId: spaceId, limit: 1 },
  ]);
  const ent = res?.entities[0];
  if (!ent) return null;
  const raw = ent.attributes[SpaceAttr.hostId.key];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

async function createSpaceAction(db: PatchDb, myId: string): Promise<string> {
  const now = isoNow();
  const spaceId = crypto.randomUUID();
  await db.write([
    {
      entityId: spaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: mergePlain(
        SpaceAttr.hostId(myId),
        SpaceAttr.createdAt(now)
      ),
    },
  ]);
  return spaceId;
}

async function joinSpaceAction(
  db: PatchDb,
  myId: string,
  spaceId: string
): Promise<void> {
  const hostId = await readSpaceHostId(db, spaceId);
  if (hostId === null) {
    throw new Error('Space not found');
  }
  if (hostId === myId) {
    throw new Error('Host is already in this space');
  }
  const now = isoNow();
  await db.write([
    {
      entityId: spaceGuestMembershipEntityId(myId, spaceId),
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: mergePlain(
        SpaceMembershipAttr.guestId(myId),
        SpaceMembershipAttr.spaceId(spaceId),
        SpaceMembershipAttr.joinedAt(now),
        SpaceMembershipAttr.leftAt(null)
      ),
    },
  ]);
}

async function leaveSpaceAction(
  db: PatchDb,
  myId: string,
  spaceId: string
): Promise<void> {
  await db.write([
    {
      entityId: spaceGuestMembershipEntityId(myId, spaceId),
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: SpaceMembershipAttr.leftAt(isoNow()),
    },
  ]);
}

async function endSpaceAction(
  db: PatchDb,
  myId: string,
  spaceId: string
): Promise<void> {
  const hostId = await readSpaceHostId(db, spaceId);
  if (hostId !== myId) {
    throw new Error('Only the host can end this space');
  }
  const now = isoNow();
  await db.write([
    {
      entityId: spaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: mergePlain(SpaceAttr.endedAt(now), SpaceAttr.hostId(myId)),
    },
  ]);
}

export function useSpaceActions() {
  const db = usePatchDb();
  const myId = useMyId();

  const createSpace = useCallback(async () => {
    return createSpaceAction(db, myId);
  }, [db, myId]);

  const joinSpace = useCallback(
    async (spaceId: string) => {
      return joinSpaceAction(db, myId, spaceId);
    },
    [db, myId]
  );

  const leaveSpace = useCallback(
    async (spaceId: string) => {
      return leaveSpaceAction(db, myId, spaceId);
    },
    [db, myId]
  );

  const endSpace = useCallback(
    async (spaceId: string) => {
      return endSpaceAction(db, myId, spaceId);
    },
    [db, myId]
  );

  return { createSpace, joinSpace, leaveSpace, endSpace };
}
