import { spaceGuestMembershipEntityId } from '@libs/spaces/shared/membership-key';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@libs/spaces/shared/space-entities';
import type { PatchDb } from '@pkgs/patch-db/interface';
import { usePatchDb } from '@pkgs/patch-db/react';
import { useCallback } from 'react';

import { useMyId } from '@libs/auth/client/use-current-user';

function isoNow(): string {
  return new Date().toISOString();
}

async function readSpaceEntity(
  db: PatchDb,
  spaceId: string
): Promise<{ hostId: string; endedAt: string | null } | null> {
  const [res] = await db.read([
    { entityType: SPACE_ENTITY_TYPE, entityId: spaceId, limit: 1 },
  ]);
  const ent = res?.entities[0];
  if (!ent) return null;
  const hostId = SpaceAttr.hostId.from(ent.attributes);
  if (hostId === null) return null;
  const endedAt = SpaceAttr.endedAt.from(ent.attributes);
  return { hostId, endedAt };
}

async function writeCreateSpaceAction(
  db: PatchDb,
  myId: string,
  spaceId: string
): Promise<void> {
  const now = isoNow();
  await db.write([
    {
      entityId: spaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: {
        ...SpaceAttr.hostId(myId),
        ...SpaceAttr.createdAt(now),
      },
    },
  ]);
}

async function joinSpaceAction(
  db: PatchDb,
  myId: string,
  spaceId: string
): Promise<void> {
  const space = await readSpaceEntity(db, spaceId);
  if (space === null) {
    throw new Error('Space not found');
  }
  if (space.endedAt !== null) {
    throw new Error('Space has ended');
  }
  if (space.hostId === myId) {
    throw new Error('Host is already in this space');
  }
  const now = isoNow();
  await db.write([
    {
      entityId: spaceGuestMembershipEntityId(myId, spaceId),
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: {
        ...SpaceMembershipAttr.guestId(myId),
        ...SpaceMembershipAttr.spaceId(spaceId),
        ...SpaceMembershipAttr.joinedAt(now),
        ...SpaceMembershipAttr.leftAt(null),
      },
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
  const space = await readSpaceEntity(db, spaceId);
  if (space === null || space.hostId !== myId) {
    throw new Error('Only the host can end this space');
  }
  const now = isoNow();
  await db.write([
    {
      entityId: spaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: { ...SpaceAttr.endedAt(now), ...SpaceAttr.hostId(myId) },
    },
  ]);
}

async function renameSpaceAction(
  db: PatchDb,
  myId: string,
  spaceId: string,
  title: string
): Promise<void> {
  const space = await readSpaceEntity(db, spaceId);
  if (space === null || space.hostId !== myId) {
    throw new Error('Only the host can rename this space');
  }
  // hostId is re-stamped so the spaces ABAC policy can authorise the write
  // from the patch alone (it only inspects patch attributes, not snapshots).
  const trimmed = title.trim();
  await db.write([
    {
      entityId: spaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: {
        ...SpaceAttr.title(trimmed.length > 0 ? trimmed : null),
        ...SpaceAttr.hostId(myId),
      },
    },
  ]);
}

export function useSpaceActions() {
  const db = usePatchDb();
  const myId = useMyId();

  const createSpace = useCallback((onCreated?: (spaceId: string) => void): string => {
    const spaceId = crypto.randomUUID();
    onCreated?.(spaceId);
    void writeCreateSpaceAction(db, myId, spaceId);
    return spaceId;
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

  const renameSpace = useCallback(
    async (spaceId: string, title: string) => {
      return renameSpaceAction(db, myId, spaceId, title);
    },
    [db, myId]
  );

  return {
    createSpace,
    joinSpace,
    leaveSpace,
    endSpace,
    renameSpace,
  };
}
