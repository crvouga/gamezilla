import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { useCallback } from 'react';

type WritePatches = Parameters<PatchDb['write']>[0];

function isoNow(): string {
  return new Date().toISOString();
}

async function readActiveHostMembership(
  db: PatchDb,
  principalId: string
): Promise<{ spaceId: string } | null> {
  const [memRes] = await db.read([
    {
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      entityId: principalId,
    },
  ]);
  const mem = memRes?.entities[0];
  if (!mem) return null;
  const sid = mem.attributes[SpaceMembershipAttr.spaceId];
  const role = mem.attributes[SpaceMembershipAttr.role];
  const leftAt = mem.attributes[SpaceMembershipAttr.leftAt];
  if (leftAt) return null;
  if (role !== 'host') return null;
  if (typeof sid !== 'string' || sid.length === 0) return null;
  return { spaceId: sid };
}

function endHostedSpacePatches(
  hostSpaceId: string,
  principalId: string,
  now: string
): WritePatches {
  return [
    {
      entityId: hostSpaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: { [SpaceAttr.endedAt]: now },
    },
    {
      entityId: principalId,
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: { [SpaceMembershipAttr.leftAt]: now },
    },
  ];
}

async function createSpaceAction(
  db: PatchDb,
  principalId: string
): Promise<string | undefined> {
  const now = isoNow();
  const patches: WritePatches = [];

  const hosted = await readActiveHostMembership(db, principalId);
  if (hosted) {
    patches.push(...endHostedSpacePatches(hosted.spaceId, principalId, now));
  }

  const spaceId = crypto.randomUUID();
  patches.push(
    {
      entityId: spaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: {
        [SpaceAttr.hostId]: principalId,
        [SpaceAttr.createdAt]: now,
      },
    },
    {
      entityId: principalId,
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: {
        [SpaceMembershipAttr.spaceId]: spaceId,
        [SpaceMembershipAttr.role]: 'host',
        [SpaceMembershipAttr.joinedAt]: now,
        [SpaceMembershipAttr.leftAt]: null,
      },
    }
  );

  await db.write(patches);
  return spaceId;
}

async function joinSpaceAction(
  db: PatchDb,
  principalId: string,
  spaceId: string
): Promise<void> {
  const now = isoNow();
  const patches: WritePatches = [];
  const hosted = await readActiveHostMembership(db, principalId);
  if (hosted && hosted.spaceId !== spaceId) {
    patches.push(...endHostedSpacePatches(hosted.spaceId, principalId, now));
  }
  patches.push({
    entityId: principalId,
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    attributes: {
      [SpaceMembershipAttr.spaceId]: spaceId,
      [SpaceMembershipAttr.role]: 'guest',
      [SpaceMembershipAttr.joinedAt]: now,
      [SpaceMembershipAttr.leftAt]: null,
    },
  });
  await db.write(patches);
}

async function leaveSpaceAction(
  db: PatchDb,
  principalId: string
): Promise<void> {
  await db.write([
    {
      entityId: principalId,
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: { [SpaceMembershipAttr.leftAt]: isoNow() },
    },
  ]);
}

async function endSpaceAction(
  db: PatchDb,
  principalId: string,
  spaceId: string
): Promise<void> {
  const now = isoNow();
  await db.write(endHostedSpacePatches(spaceId, principalId, now));
}

export function useSpaceActions() {
  const db = usePatchDb();
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();

  const createSpace = useCallback(
    () => createSpaceAction(db, principalId),
    [db, principalId]
  );
  const joinSpace = useCallback(
    (spaceId: string) => joinSpaceAction(db, principalId, spaceId),
    [db, principalId]
  );
  const leaveSpace = useCallback(
    () => leaveSpaceAction(db, principalId),
    [db, principalId]
  );
  const endSpace = useCallback(
    (spaceId: string) => endSpaceAction(db, principalId, spaceId),
    [db, principalId]
  );

  return { createSpace, joinSpace, leaveSpace, endSpace };
}
