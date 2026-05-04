import { useDeviceService } from '@gamezilla/client/runtime/runtime-hooks';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { useCallback } from 'react';

type WritePatches = Parameters<PatchDb['write']>[0];

function isoNow(): string {
  return new Date().toISOString();
}

async function readActiveHostMembership(
  db: PatchDb,
  deviceId: string
): Promise<{ spaceId: string } | null> {
  const [memRes] = await db.read([
    {
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      entityId: deviceId,
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
  deviceId: string,
  now: string
): WritePatches {
  return [
    {
      entityId: hostSpaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: { [SpaceAttr.endedAt]: now },
    },
    {
      entityId: deviceId,
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: { [SpaceMembershipAttr.leftAt]: now },
    },
  ];
}

async function createSpaceAction(
  db: PatchDb,
  deviceId: string
): Promise<string | undefined> {
  const now = isoNow();
  const patches: WritePatches = [];

  const hosted = await readActiveHostMembership(db, deviceId);
  if (hosted) {
    patches.push(...endHostedSpacePatches(hosted.spaceId, deviceId, now));
  }

  const spaceId = crypto.randomUUID();
  patches.push(
    {
      entityId: spaceId,
      entityType: SPACE_ENTITY_TYPE,
      attributes: {
        [SpaceAttr.hostId]: deviceId,
        [SpaceAttr.createdAt]: now,
      },
    },
    {
      entityId: deviceId,
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
  deviceId: string,
  spaceId: string
): Promise<void> {
  const now = isoNow();
  const patches: WritePatches = [];
  const hosted = await readActiveHostMembership(db, deviceId);
  if (hosted && hosted.spaceId !== spaceId) {
    patches.push(...endHostedSpacePatches(hosted.spaceId, deviceId, now));
  }
  patches.push({
    entityId: deviceId,
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

async function leaveSpaceAction(db: PatchDb, deviceId: string): Promise<void> {
  await db.write([
    {
      entityId: deviceId,
      entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
      attributes: { [SpaceMembershipAttr.leftAt]: isoNow() },
    },
  ]);
}

async function endSpaceAction(
  db: PatchDb,
  deviceId: string,
  spaceId: string
): Promise<void> {
  const now = isoNow();
  await db.write(endHostedSpacePatches(spaceId, deviceId, now));
}

export function useSpaceActions() {
  const db = usePatchDb();
  const deviceService = useDeviceService();
  const deviceId = deviceService.getDeviceId();

  const createSpace = useCallback(
    () => createSpaceAction(db, deviceId),
    [db, deviceId]
  );
  const joinSpace = useCallback(
    (spaceId: string) => joinSpaceAction(db, deviceId, spaceId),
    [db, deviceId]
  );
  const leaveSpace = useCallback(
    () => leaveSpaceAction(db, deviceId),
    [db, deviceId]
  );
  const endSpace = useCallback(
    (spaceId: string) => endSpaceAction(db, deviceId, spaceId),
    [db, deviceId]
  );

  return { createSpace, joinSpace, leaveSpace, endSpace };
}
