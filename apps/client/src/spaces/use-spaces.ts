import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  LAST_MODIFIED_BY_ACCOUNT_ID_KEY,
  LAST_MODIFIED_BY_PRINCIPAL_ID_KEY,
} from '@gamezilla/client/auth/last-modified-by-patches-db';
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
import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';

import type { SpaceMemberRow, SpaceView } from './types';

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

/**
 * Resolves the profile entity id to look up for a principal:
 * - When `principalId` is the current viewer and they're signed in, use the
 *   auth-supplied accountId directly (matches `useProfile()`).
 * - Otherwise read `principal/accountId` from the principal entity, falling
 *   back to the principal-local profile id.
 */
function resolveProfileKey(args: {
  principalId: string;
  principalById: Map<string, Entity>;
  selfPrincipalId: string;
  selfAccountId: string | null;
}): string {
  const { principalId, principalById, selfPrincipalId, selfAccountId } = args;
  if (principalId === selfPrincipalId && selfAccountId !== null) {
    return selfAccountId;
  }
  const principalRow = principalById.get(principalId);
  const accountIdAttr = readStringAttr(
    principalRow?.attributes as Record<string, unknown> | undefined,
    PrincipalAttr.accountId
  );
  return accountIdAttr ?? principalId;
}

function principalPresentation(args: {
  principalId: string;
  principalById: Map<string, Entity>;
  profileById: Map<string, Entity>;
  selfPrincipalId: string;
  selfAccountId: string | null;
}): { displayName: string; avatarConfig: AvatarConfig | null } {
  const profileKey = resolveProfileKey(args);
  const profileEntity = args.profileById.get(profileKey);
  const attrs = profileEntity?.attributes as Record<string, unknown> | undefined;
  return {
    displayName: displayNameForPrincipal(
      attrs?.[ProfileAttr.displayName],
      args.principalId
    ),
    avatarConfig: parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig),
  };
}

/**
 * Loads the current viewer's account-scoped profile (when signed in) so
 * callers can layer it onto bulk-fetched profile maps. This makes the dynamic
 * space title fall back to the live account display name without waiting for
 * the principal entity's `accountId` attribute to sync.
 */
function useSelfAccountProfile(selfAccountId: string | null): {
  entity: Entity | null;
  loading: boolean;
} {
  const res = useEntities(
    selfAccountId !== null
      ? { entityType: PROFILE_ENTITY_TYPE, entityId: selfAccountId }
      : { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
  );
  return { entity: res.entities[0] ?? null, loading: res.loading };
}

function withSelfAccountProfile(
  profileById: Map<string, Entity>,
  selfAccountId: string | null,
  selfAccountProfile: Entity | null
): Map<string, Entity> {
  if (selfAccountId === null || selfAccountProfile === null) return profileById;
  return new Map(profileById).set(selfAccountId, selfAccountProfile);
}

function useSelfAuthIdentity(): {
  selfPrincipalId: string;
  selfAccountId: string | null;
} {
  const principalService = useDependency(PrincipalServiceToken);
  const auth = useAuth();
  return {
    selfPrincipalId: principalService.getPrincipalId(),
    selfAccountId: auth.mode === 'signed-in' ? auth.accountId : null,
  };
}

const LIVE_SPACES_QUERY: PatchesDbQuery = {
  entityType: SPACE_ENTITY_TYPE,
  where: {
    type: 'not_exists' as const,
    attribute: SpaceAttr.endedAt,
  },
  orderBy: [{ attribute: SpaceAttr.createdAt, direction: 'desc' }],
};

function buildSpaceView(args: {
  entity: Entity;
  principalById: Map<string, Entity>;
  profileById: Map<string, Entity>;
  selfPrincipalId: string;
  selfAccountId: string | null;
  t: ReturnType<typeof useLingui>['t'];
}): SpaceView {
  const { entity, t } = args;
  const customTitle = readStringAttr(entity.attributes, SpaceAttr.title);
  const hostId = readStringAttr(entity.attributes, SpaceAttr.hostId) ?? '';
  const { displayName: hostDisplayName, avatarConfig: hostAvatarConfig } =
    principalPresentation({
      principalId: hostId,
      principalById: args.principalById,
      profileById: args.profileById,
      selfPrincipalId: args.selfPrincipalId,
      selfAccountId: args.selfAccountId,
    });
  const title = customTitle ?? t`${hostDisplayName}'s space`;
  return {
    id: entity.entityId,
    title,
    customTitle,
    hostId,
    hostDisplayName,
    hostAvatarConfig,
  };
}

export function useSpaces() {
  const { selfPrincipalId, selfAccountId } = useSelfAuthIdentity();
  const { t } = useLingui();

  const spacesResult = useEntities(LIVE_SPACES_QUERY);

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

  const { entity: selfAccountProfile, loading: selfProfileLoading } =
    useSelfAccountProfile(selfAccountId);

  const spaces: SpaceView[] = useMemo(() => {
    const list = spacesResult.entities ?? [];
    const augmented = withSelfAccountProfile(
      profileById,
      selfAccountId,
      selfAccountProfile
    );
    return list.map((entity) =>
      buildSpaceView({
        entity,
        principalById,
        profileById: augmented,
        selfPrincipalId,
        selfAccountId,
        t,
      })
    );
  }, [
    spacesResult.entities,
    principalById,
    profileById,
    selfAccountProfile,
    selfPrincipalId,
    selfAccountId,
    t,
  ]);

  const loading =
    spacesResult.loading || hostProfilesLoading || selfProfileLoading;

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

  const customTitle = readStringAttr(entity?.attributes, SpaceAttr.title);
  const hostId = readStringAttr(entity?.attributes, SpaceAttr.hostId);
  const hostDisplayName = usePrincipalDisplayName(hostId);
  const { t } = useLingui();
  const title = customTitle ?? t`${hostDisplayName}'s space`;

  return {
    space: entity,
    loading: spaceRes.loading,
    title,
    customTitle,
    hostId,
    hostDisplayName,
    createdAt: readStringAttr(entity?.attributes, SpaceAttr.createdAt),
    live: entity ? spaceEntityIsLive(entity.attributes) : false,
    endedAt: readStringAttr(entity?.attributes, SpaceAttr.endedAt),
  };
}

/**
 * Display label for a principal's current profile (for host / join UI).
 *
 * Selection rules:
 * - When the principal is the current viewer, the auth context drives the lookup:
 *   signed-in → account profile (`entityId === accountId`),
 *   guest → principal-local profile (`entityId === principalId`).
 *   This matches `useProfile()` and avoids waiting on the principal entity to
 *   reflect a freshly bound `accountId`.
 * - For other principals we still derive the profile id from their principal entity
 *   when visible.
 */
export function usePrincipalDisplayName(
  principalId: string | null | undefined
) {
  const principalService = useDependency(PrincipalServiceToken);
  const selfPrincipalId = principalService.getPrincipalId();
  const auth = useAuth();
  const selfAccountId =
    auth.mode === 'signed-in' ? auth.accountId : null;

  const id =
    typeof principalId === 'string' && principalId.length > 0
      ? principalId
      : NO_ENTITY_PLACEHOLDER;
  const isSelf = id !== NO_ENTITY_PLACEHOLDER && id === selfPrincipalId;
  const skipPrincipalLookup = isSelf && selfAccountId !== null;

  const principalRes = useEntities(
    id === NO_ENTITY_PLACEHOLDER || skipPrincipalLookup
      ? { entityType: PRINCIPAL_ENTITY_TYPE, limit: 0 }
      : { entityType: PRINCIPAL_ENTITY_TYPE, entityId: id }
  );
  const principalRow = principalRes.entities[0] ?? null;
  const accountIdFromEntity =
    id === NO_ENTITY_PLACEHOLDER
      ? null
      : readStringAttr(
          principalRow?.attributes as Record<string, unknown> | undefined,
          PrincipalAttr.accountId
        );
  const accountId = isSelf ? selfAccountId : accountIdFromEntity;
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
          attribute: LAST_MODIFIED_BY_ACCOUNT_ID_KEY,
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
        attribute: LAST_MODIFIED_BY_PRINCIPAL_ID_KEY,
        value: principalId,
      },
      {
        type: 'not_exists',
        attribute: LAST_MODIFIED_BY_ACCOUNT_ID_KEY,
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

function compareMembers(a: SpaceMemberRow, b: SpaceMemberRow): number {
  if (a.role === 'host' && b.role !== 'host') return -1;
  if (a.role !== 'host' && b.role === 'host') return 1;
  return a.displayName.localeCompare(b.displayName);
}

function buildMemberRow(args: {
  membership: Entity;
  principalById: Map<string, Entity>;
  profileById: Map<string, Entity>;
  selfPrincipalId: string;
  selfAccountId: string | null;
}): SpaceMemberRow {
  const { membership } = args;
  const roleRaw = membership.attributes[SpaceMembershipAttr.role];
  const role: 'host' | 'guest' = roleRaw === 'host' ? 'host' : 'guest';
  return {
    principalId: membership.entityId,
    ...principalPresentation({
      principalId: membership.entityId,
      principalById: args.principalById,
      profileById: args.profileById,
      selfPrincipalId: args.selfPrincipalId,
      selfAccountId: args.selfAccountId,
    }),
    role,
  };
}

export function useSpaceMembers(spaceId: string | undefined) {
  const { selfPrincipalId, selfAccountId } = useSelfAuthIdentity();

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

  const memberPrincipalIds = useMemo(() => {
    const ids = (membersRes.entities ?? []).map((e) => e.entityId);
    return ids.length > 0 ? ids : [selfPrincipalId];
  }, [membersRes.entities, selfPrincipalId]);

  const { principalById, profileById, loading: memberProfilesLoading } =
    usePrincipalProfileEntities(memberPrincipalIds);

  const { entity: selfAccountProfile, loading: selfProfileLoading } =
    useSelfAccountProfile(selfAccountId);

  const members: SpaceMemberRow[] = useMemo(() => {
    const augmented = withSelfAccountProfile(
      profileById,
      selfAccountId,
      selfAccountProfile
    );
    const rows: SpaceMemberRow[] = (membersRes.entities ?? []).map(
      (membership) =>
        buildMemberRow({
          membership,
          principalById,
          profileById: augmented,
          selfPrincipalId,
          selfAccountId,
        })
    );
    rows.sort(compareMembers);
    return rows;
  }, [
    membersRes.entities,
    principalById,
    profileById,
    selfAccountProfile,
    selfPrincipalId,
    selfAccountId,
  ]);

  const loading =
    membersRes.loading || memberProfilesLoading || selfProfileLoading;

  return { members, loading };
}
