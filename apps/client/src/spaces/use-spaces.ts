import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  PATCH_LAST_MODIFIED_BY_ACCOUNT,
  PATCH_LAST_MODIFIED_BY_PRINCIPAL,
} from '@gamezilla/patch-db/metadata/patch-metadata';
import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import { usePrincipalProfileEntities } from '@gamezilla/client/auth/use-principal-profile-entities';
import { displayNameForPrincipal } from '@gamezilla/client/profile/principal-display';
import {
  PRINCIPAL_ENTITY_TYPE,
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { parseAvatarConfigAttr } from '@gamezilla/domain/profile/avatar-config';
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
import type {
  Entity,
  PatchesDbQuery,
  PatchesDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';
import { useEntities } from '@gamezilla/patch-db/react';
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

function principalPresentation(
  principalId: string,
  principalById: Map<string, Entity>,
  profileById: Map<string, Entity>
): { displayName: string; avatarConfig: AvatarConfig | null } {
  const principalRow = principalById.get(principalId);
  const accountId = readStringAttr(
    principalRow?.attributes as Record<string, unknown> | undefined,
    PrincipalAttr.accountId
  );
  const profileKey = accountId ?? principalId;
  const profileEntity = profileById.get(profileKey);
  const attrs = profileEntity?.attributes as Record<string, unknown> | undefined;
  return {
    displayName: displayNameForPrincipal(
      attrs?.[ProfileAttr.displayName],
      principalId
    ),
    avatarConfig: parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig),
  };
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
    ids.add(selfPrincipalId);
    return [...ids];
  }, [spacesResult.entities, selfPrincipalId]);

  const { principalById, profileById, loading: hostProfilesLoading } =
    usePrincipalProfileEntities(hostIds);

  const spaces: SpaceView[] = useMemo(() => {
    const list = spacesResult.entities ?? [];
    return list.map((e) => {
      const title = readStringAttr(e.attributes, SpaceAttr.title) ?? 'Untitled';
      const hostId = readStringAttr(e.attributes, SpaceAttr.hostId) ?? '';
      const live = spaceEntityIsLive(e.attributes);
      const { displayName: hostDisplayName, avatarConfig: hostAvatarConfig } =
        principalPresentation(hostId, principalById, profileById);
      return {
        id: e.entityId,
        title,
        hostId,
        hostDisplayName,
        hostAvatarConfig,
        live,
      };
    });
  }, [spacesResult.entities, principalById, profileById]);

  const loading = spacesResult.loading || hostProfilesLoading;

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

/** Display label for a principal's current profile (for host / join UI). */
export function usePrincipalDisplayName(
  principalId: string | null | undefined
) {
  const id =
    typeof principalId === 'string' && principalId.length > 0
      ? principalId
      : NO_ENTITY_PLACEHOLDER;

  const principalRes = useEntities(
    id === NO_ENTITY_PLACEHOLDER
      ? { entityType: PRINCIPAL_ENTITY_TYPE, limit: 0 }
      : { entityType: PRINCIPAL_ENTITY_TYPE, entityId: id }
  );
  const principalRow = principalRes.entities[0] ?? null;
  const accountId =
    id === NO_ENTITY_PLACEHOLDER
      ? null
      : readStringAttr(
          principalRow?.attributes as Record<string, unknown> | undefined,
          PrincipalAttr.accountId
        );
  const profileEntityId =
    id === NO_ENTITY_PLACEHOLDER
      ? NO_ENTITY_PLACEHOLDER
      : accountId !== null
        ? accountId
        : id;

  const profileRes = useEntities({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: profileEntityId,
  });
  const profileEntity = profileRes.entities[0] ?? null;

  return useMemo(() => {
    const effectiveId = id === NO_ENTITY_PLACEHOLDER ? 'unknown' : id;
    const raw = profileEntity?.attributes[ProfileAttr.displayName];
    return displayNameForPrincipal(raw, effectiveId);
  }, [id, profileEntity]);
}

export type CurrentMembership = {
  /** Active space id when the user is a member of a live space. */
  activeSpaceId: string | null;
  role: SpaceMembershipRole | null;
  membershipEntity: Entity | null;
  loading: boolean;
};

function resolveCurrentMembership(args: {
  membership: Entity | null;
  hasLeft: boolean;
  spaceIdRaw: string | null;
  spaceEntity: Entity | null;
  spaceEnded: boolean;
  role: SpaceMembershipRole | null;
  memLoading: boolean;
  spaceLoading: boolean;
}): CurrentMembership {
  const {
    membership,
    hasLeft,
    spaceIdRaw,
    spaceEntity,
    spaceEnded,
    role,
    memLoading,
    spaceLoading,
  } = args;
  const loading = memLoading || spaceLoading;
  const inactive: CurrentMembership = {
    activeSpaceId: null,
    role: null,
    membershipEntity: membership,
    loading,
  };
  if (!membership || hasLeft || !spaceIdRaw) return inactive;
  if (spaceLoading) return { ...inactive, loading: true };
  if (!spaceEntity || spaceEnded) return { ...inactive, loading: false };
  return {
    activeSpaceId: spaceIdRaw,
    role,
    membershipEntity: membership,
    loading: false,
  };
}

function extractMembershipState(membership: Entity | null): {
  spaceIdRaw: string | null;
  hasLeft: boolean;
  role: SpaceMembershipRole | null;
} {
  const spaceIdRaw = readStringAttr(
    membership?.attributes,
    SpaceMembershipAttr.spaceId
  );
  const leftAt = membership?.attributes[SpaceMembershipAttr.leftAt];
  const hasLeft = leftAt !== undefined && leftAt !== null;
  const roleRaw = membership?.attributes[SpaceMembershipAttr.role];
  const role: SpaceMembershipRole | null =
    roleRaw === 'host' || roleRaw === 'guest' ? roleRaw : null;
  return { spaceIdRaw, hasLeft, role };
}

function membershipStampWhere(args: {
  signedIn: boolean;
  accountId: string | null;
  principalId: string;
}): PatchesDbQueryWhereClause {
  const { signedIn, accountId, principalId } = args;
  const leftClause = {
    type: 'not_exists' as const,
    attribute: SpaceMembershipAttr.leftAt,
  };
  if (signedIn && accountId !== null) {
    return {
      type: 'and',
      clauses: [
        {
          type: '=',
          attribute: PATCH_LAST_MODIFIED_BY_ACCOUNT,
          value: accountId,
        },
        leftClause,
      ],
    };
  }
  return {
    type: 'and',
    clauses: [
      {
        type: '=',
        attribute: PATCH_LAST_MODIFIED_BY_PRINCIPAL,
        value: principalId,
      },
      {
        type: 'not_exists',
        attribute: PATCH_LAST_MODIFIED_BY_ACCOUNT,
      },
      leftClause,
    ],
  };
}

export function useCurrentMembership(): CurrentMembership {
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();
  const auth = useAuth();
  const signedIn = auth.mode === 'signed-in';
  const accountId = auth.accountId;

  const stampWhere = useMemo(
    () =>
      membershipStampWhere({
        signedIn,
        accountId,
        principalId,
      }),
    [signedIn, accountId, principalId]
  );

  const memRes = useEntities({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    where: stampWhere,
    limit: 50,
    orderBy: [
      { attribute: SpaceMembershipAttr.joinedAt, direction: 'desc' },
    ],
  });

  const membership = useMemo(() => {
    const list = memRes.entities ?? [];
    const preferred = list.find((e) => e.entityId === principalId);
    return (preferred ?? list[0] ?? null) as Entity | null;
  }, [memRes.entities, principalId]);

  const { spaceIdRaw, hasLeft, role } = extractMembershipState(membership);

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

  return useMemo(
    () =>
      resolveCurrentMembership({
        membership,
        hasLeft,
        spaceIdRaw,
        spaceEntity,
        spaceEnded,
        role,
        memLoading: memRes.loading,
        spaceLoading: spaceRes.loading,
      }),
    [
      membership,
      hasLeft,
      spaceIdRaw,
      spaceEnded,
      spaceEntity,
      role,
      memRes.loading,
      spaceRes.loading,
    ]
  );
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

  const memberPrincipalIds =
    memberIds.length > 0 ? memberIds : [selfId];

  const { principalById, profileById, loading: memberProfilesLoading } =
    usePrincipalProfileEntities(memberPrincipalIds);

  const members: SpaceMemberRow[] = useMemo(() => {
    const rows: SpaceMemberRow[] = [];
    for (const e of membersRes.entities ?? []) {
      const roleRaw = e.attributes[SpaceMembershipAttr.role];
      const role: 'host' | 'guest' = roleRaw === 'host' ? 'host' : 'guest';
      rows.push({
        principalId: e.entityId,
        ...principalPresentation(e.entityId, principalById, profileById),
        role,
      });
    }
    rows.sort((a, b) => {
      if (a.role === 'host' && b.role !== 'host') return -1;
      if (a.role !== 'host' && b.role === 'host') return 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return rows;
  }, [membersRes.entities, principalById, profileById]);

  const loading = membersRes.loading || memberProfilesLoading;

  return { members, loading };
}
