import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import { usePatchesDb } from '@gamezilla/patch-db/react';
import { useCallback } from 'react';

function isoNow(): string {
  return new Date().toISOString();
}

export function useSpaceActions() {
  const db = usePatchesDb();
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();

  const createSpace = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      const now = isoNow();
      const patches: Parameters<typeof db.write>[0] = [];

      const [memRes] = await db.read([
        {
          entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
          entityId: principalId,
        },
      ]);
      const mem = memRes?.entities[0];
      if (mem) {
        const sid = mem.attributes[SpaceMembershipAttr.spaceId];
        const role = mem.attributes[SpaceMembershipAttr.role];
        const leftAt = mem.attributes[SpaceMembershipAttr.leftAt];
        if (
          !leftAt &&
          role === 'host' &&
          typeof sid === 'string' &&
          sid.length > 0
        ) {
          patches.push({
            entityId: sid,
            entityType: SPACE_ENTITY_TYPE,
            attributes: { [SpaceAttr.endedAt]: now },
          });
          patches.push({
            entityId: principalId,
            entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
            attributes: { [SpaceMembershipAttr.leftAt]: now },
          });
        }
      }

      const spaceId = crypto.randomUUID();
      patches.push(
        {
          entityId: spaceId,
          entityType: SPACE_ENTITY_TYPE,
          attributes: {
            [SpaceAttr.title]: trimmed,
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
    },
    [db, principalId]
  );

  const joinSpace = useCallback(
    async (spaceId: string) => {
      const now = isoNow();
      const patches: Parameters<typeof db.write>[0] = [];

      const [memRes] = await db.read([
        {
          entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
          entityId: principalId,
        },
      ]);
      const mem = memRes?.entities[0];
      if (mem) {
        const curSid = mem.attributes[SpaceMembershipAttr.spaceId];
        const role = mem.attributes[SpaceMembershipAttr.role];
        const leftAt = mem.attributes[SpaceMembershipAttr.leftAt];
        if (
          !leftAt &&
          role === 'host' &&
          typeof curSid === 'string' &&
          curSid !== spaceId
        ) {
          patches.push({
            entityId: curSid,
            entityType: SPACE_ENTITY_TYPE,
            attributes: { [SpaceAttr.endedAt]: now },
          });
          patches.push({
            entityId: principalId,
            entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
            attributes: { [SpaceMembershipAttr.leftAt]: now },
          });
        }
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
    },
    [db, principalId]
  );

  const leaveSpace = useCallback(async () => {
    await db.write([
      {
        entityId: principalId,
        entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
        attributes: { [SpaceMembershipAttr.leftAt]: isoNow() },
      },
    ]);
  }, [db, principalId]);

  const endSpace = useCallback(
    async (spaceId: string) => {
      const now = isoNow();
      await db.write([
        {
          entityId: spaceId,
          entityType: SPACE_ENTITY_TYPE,
          attributes: { [SpaceAttr.endedAt]: now },
        },
        {
          entityId: principalId,
          entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
          attributes: { [SpaceMembershipAttr.leftAt]: now },
        },
      ]);
    },
    [db, principalId]
  );

  return { createSpace, joinSpace, leaveSpace, endSpace };
}
