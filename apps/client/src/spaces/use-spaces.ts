import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
  type SpaceMembershipRole,
} from '@gamezilla/domain/spaces/space-entities';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { Entity, PatchesDbQuery } from '@gamezilla/patch-db/interface';
import { useEntities, useEntity } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

import type { SpaceFilter, SpaceMemberRow, SpaceView } from './types';

const NO_ENTITY_PLACEHOLDER = '__patch_db_no_entity__';

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function spaceEntityIsLive(
  attrs: Record<string, unknown> | undefined
): boolean {
  const ended = attrs?.[SpaceAttr.endedAt];
  return ended === undefined || ended === null;
}

function displayNameForPrincipal(
  profile: Entity | undefined,
  principalId: string
): string {
  const raw = profile?.attributes[ProfileAttr.displayName];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length > 0) return trimmed;
  return `User ${principalId.slice(0, 8)}`;
}

export function useSpaces(filter: SpaceFilter) {
  const principalService = useDependency(PrincipalServiceToken);
  const selfPrincipalId = principalService.getPrincipalId();

  const liveWhere = {
    type: 'not_exists' as const,
    attribute: SpaceAttr.endedAt,
  };

  const spacesQuery: PatchesDbQuery =
    filter === 'live'
      ? {
          entityType: SPACE_ENTITY_TYPE,
          where: liveWhere,
          orderBy: [{ attribute: SpaceAttr.createdAt, direction: 'desc' }],
        }
      : {
          entityType: SPACE_ENTITY_TYPE,
          orderBy: [{ attribute: SpaceAttr.createdAt, direction: 'desc' }],
        };

  const spacesResult = useEntities(spacesQuery);

  const hostIds = useMemo(() => {
    const list = spacesResult.entities ?? [];
    const ids = new Set<string>();
    for (const e of list) {
      const hid = readStringAttr(e.attributes, SpaceAttr.hostId);
      if (hid) ids.add(hid);
    }
    return [...ids];
  }, [spacesResult.entities]);

  const profileIdsForHosts = hostIds.length > 0 ? hostIds : [selfPrincipalId];

  const profilesResult = useEntities({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: profileIdsForHosts,
  });

  const profileByPrincipalId = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const p of profilesResult.entities ?? []) {
      m.set(p.entityId, p);
    }
    return m;
  }, [profilesResult.entities]);

  const spaces: SpaceView[] = useMemo(() => {
    const list = spacesResult.entities ?? [];
    return list.map((e) => {
      const title = readStringAttr(e.attributes, SpaceAttr.title) ?? 'Untitled';
      const hostId = readStringAttr(e.attributes, SpaceAttr.hostId) ?? '';
      const live = spaceEntityIsLive(e.attributes);
      const hostDisplayName = displayNameForPrincipal(
        profileByPrincipalId.get(hostId),
        hostId
      );
      return {
        id: e.entityId,
        title,
        hostId,
        hostDisplayName,
        live,
      };
    });
  }, [spacesResult.entities, profileByPrincipalId]);

  const loading = spacesResult.loading || profilesResult.loading;

  return { spaces, loading };
}

export function useSpace(spaceId: string | undefined) {
  const id =
    typeof spaceId === 'string' && spaceId.length > 0
      ? spaceId
      : NO_ENTITY_PLACEHOLDER;
  const spaceRes = useEntities({
    entityType: SPACE_ENTITY_TYPE,
    entityId: id,
  });
  const entity = spaceRes.entities[0] ?? null;

  return {
    space: entity,
    loading: spaceRes.loading,
    title: readStringAttr(entity?.attributes, SpaceAttr.title) ?? 'Untitled',
    hostId: readStringAttr(entity?.attributes, SpaceAttr.hostId),
    createdAt: readStringAttr(entity?.attributes, SpaceAttr.createdAt),
    live: entity ? spaceEntityIsLive(entity.attributes) : false,
    endedAt: readStringAttr(entity?.attributes, SpaceAttr.endedAt),
  };
}

/** Display label for any principal's profile entity (for host / join UI). */
export function usePrincipalDisplayName(
  principalId: string | null | undefined
) {
  const id =
    typeof principalId === 'string' && principalId.length > 0
      ? principalId
      : NO_ENTITY_PLACEHOLDER;
  const entity = useEntity({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: id,
  });
  if (id === NO_ENTITY_PLACEHOLDER) return 'Unknown';
  return displayNameForPrincipal(entity ?? undefined, id);
}

export type CurrentMembership = {
  /** Active space id when the user is a member of a live space. */
  activeSpaceId: string | null;
  role: SpaceMembershipRole | null;
  membershipEntity: Entity | null;
  loading: boolean;
};

export function useCurrentMembership(): CurrentMembership {
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();

  const memRes = useEntities({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: principalId,
  });
  const membership = memRes.entities[0] ?? null;

  const spaceIdRaw = readStringAttr(
    membership?.attributes,
    SpaceMembershipAttr.spaceId
  );
  const leftAt = membership?.attributes[SpaceMembershipAttr.leftAt];
  const hasLeft = leftAt !== undefined && leftAt !== null;
  const roleRaw = membership?.attributes[SpaceMembershipAttr.role];
  const role: SpaceMembershipRole | null =
    roleRaw === 'host' || roleRaw === 'guest' ? roleRaw : null;

  const spaceIdForQuery =
    spaceIdRaw && !hasLeft ? spaceIdRaw : NO_ENTITY_PLACEHOLDER;

  const spaceRes = useEntities({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceIdForQuery,
  });
  const spaceEntity = spaceRes.entities[0] ?? null;
  const spaceEnded = spaceEntity
    ? !spaceEntityIsLive(spaceEntity.attributes)
    : false;

  return useMemo(() => {
    const loading = memRes.loading || spaceRes.loading;
    if (!membership || hasLeft || !spaceIdRaw) {
      return {
        activeSpaceId: null,
        role: null,
        membershipEntity: membership,
        loading,
      };
    }
    if (spaceRes.loading) {
      return {
        activeSpaceId: null,
        role: null,
        membershipEntity: membership,
        loading: true,
      };
    }
    if (!spaceEntity || spaceEnded) {
      return {
        activeSpaceId: null,
        role: null,
        membershipEntity: membership,
        loading: false,
      };
    }
    return {
      activeSpaceId: spaceIdRaw,
      role,
      membershipEntity: membership,
      loading: false,
    };
  }, [
    membership,
    hasLeft,
    spaceIdRaw,
    spaceEnded,
    spaceEntity,
    role,
    memRes.loading,
    spaceRes.loading,
  ]);
}

export function useSpaceMembers(spaceId: string | undefined) {
  const principalService = useDependency(PrincipalServiceToken);
  const selfId = principalService.getPrincipalId();

  const sid =
    typeof spaceId === 'string' && spaceId.length > 0
      ? spaceId
      : NO_ENTITY_PLACEHOLDER;

  const membersRes = useEntities({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    where: {
      type: 'and',
      clauses: [
        { type: '=', attribute: SpaceMembershipAttr.spaceId, value: sid },
        { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt },
      ],
    },
  });

  const memberIds = useMemo(() => {
    return (membersRes.entities ?? []).map((e) => e.entityId);
  }, [membersRes.entities]);

  const profileIds = memberIds.length > 0 ? memberIds : [selfId];

  const profilesRes = useEntities({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: profileIds,
  });

  const profileById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const p of profilesRes.entities ?? []) {
      m.set(p.entityId, p);
    }
    return m;
  }, [profilesRes.entities]);

  const members: SpaceMemberRow[] = useMemo(() => {
    const rows: SpaceMemberRow[] = [];
    for (const e of membersRes.entities ?? []) {
      const roleRaw = e.attributes[SpaceMembershipAttr.role];
      const role: 'host' | 'guest' = roleRaw === 'host' ? 'host' : 'guest';
      rows.push({
        principalId: e.entityId,
        displayName: displayNameForPrincipal(
          profileById.get(e.entityId),
          e.entityId
        ),
        role,
      });
    }
    rows.sort((a, b) => {
      if (a.role === 'host' && b.role !== 'host') return -1;
      if (a.role !== 'host' && b.role === 'host') return 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return rows;
  }, [membersRes.entities, profileById]);

  const loading = membersRes.loading || profilesRes.loading;

  return { members, loading };
}
