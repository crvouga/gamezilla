import { useDeviceService } from '@gamezilla/client/runtime/runtime-hooks';
import { useDeviceProfileEntities } from '@gamezilla/client/auth/use-device-profile-entities';
import { displayNameForDevice } from '@gamezilla/client/profile/device-display';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
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
import type { Entity, PatchDbQuery } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';

import {
  devicePresentation,
  useSelfAccountProfile,
  useSelfAuthIdentity,
  withSelfAccountProfile,
} from './device-display-resolution';
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

const LIVE_SPACES_QUERY: PatchDbQuery = {
  entityType: SPACE_ENTITY_TYPE,
  where: {
    type: 'not_exists' as const,
    attribute: SpaceAttr.endedAt,
  },
  orderBy: [{ attribute: SpaceAttr.createdAt, direction: 'desc' }],
};

function buildSpaceView(args: {
  entity: Entity;
  deviceById: Map<string, Entity>;
  profileById: Map<string, Entity>;
  selfDeviceId: string;
  selfAccountId: string | null;
  t: ReturnType<typeof useLingui>['t'];
}): SpaceView {
  const { entity, t } = args;
  const customTitle = readStringAttr(entity.attributes, SpaceAttr.title);
  const hostId = readStringAttr(entity.attributes, SpaceAttr.hostId) ?? '';
  const { displayName: hostDisplayName, avatarConfig: hostAvatarConfig } =
    devicePresentation({
      deviceId: hostId,
      deviceById: args.deviceById,
      profileById: args.profileById,
      selfDeviceId: args.selfDeviceId,
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
  const { selfDeviceId, selfAccountId } = useSelfAuthIdentity();
  const { t } = useLingui();

  const spacesResult = useQuery(LIVE_SPACES_QUERY);

  const hostIds = useMemo(() => {
    const list = spacesResult.entities ?? [];
    const ids = new Set<string>();
    for (const e of list) {
      const hid = readStringAttr(e.attributes, SpaceAttr.hostId);
      if (hid) ids.add(hid);
    }
    ids.add(selfDeviceId);
    return [...ids];
  }, [spacesResult.entities, selfDeviceId]);

  const { deviceById, profileById } = useDeviceProfileEntities(hostIds);

  const { entity: selfAccountProfile } = useSelfAccountProfile(selfAccountId);

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
        deviceById,
        profileById: augmented,
        selfDeviceId,
        selfAccountId,
        t,
      })
    );
  }, [
    spacesResult.entities,
    deviceById,
    profileById,
    selfAccountProfile,
    selfDeviceId,
    selfAccountId,
    t,
  ]);

  return { spaces };
}

function readSpaceEntitySnapshot(entity: Entity | null): {
  customTitle: string | null;
  hostId: string | null;
  createdAt: string | null;
  live: boolean;
  endedAt: string | null;
  phantomPeerId: string | null;
  phantomPublicKey: string | null;
} {
  const attrs = entity?.attributes;
  return {
    customTitle: readStringAttr(attrs, SpaceAttr.title),
    hostId: readStringAttr(attrs, SpaceAttr.hostId),
    createdAt: readStringAttr(attrs, SpaceAttr.createdAt),
    live: entity ? spaceEntityIsLive(attrs) : false,
    endedAt: readStringAttr(attrs, SpaceAttr.endedAt),
    phantomPeerId: readStringAttr(attrs, SpaceAttr.phantomPeerId),
    phantomPublicKey: readStringAttr(attrs, SpaceAttr.phantomPublicKey),
  };
}

export function useSpace(spaceId: string | undefined) {
  const id =
    typeof spaceId === 'string' && spaceId.length > 0
      ? spaceId
      : NO_ENTITY_PLACEHOLDER;
  const spaceRes = useQuery({
    entityType: SPACE_ENTITY_TYPE,
    entityId: id,
  });
  const entity = spaceRes.entities[0] ?? null;
  const snap = readSpaceEntitySnapshot(entity);

  const hostDisplayName = useDeviceDisplayName(snap.hostId);
  const { t } = useLingui();
  const title = snap.customTitle ?? t`${hostDisplayName}'s space`;

  return {
    space: entity,
    title,
    customTitle: snap.customTitle,
    hostId: snap.hostId,
    hostDisplayName,
    createdAt: snap.createdAt,
    live: snap.live,
    endedAt: snap.endedAt,
    phantomPeerId: snap.phantomPeerId,
    phantomPublicKey: snap.phantomPublicKey,
    isLoading: spaceRes.isLoading,
  };
}

function normalizeDeviceId(deviceId: string | null | undefined): string {
  return typeof deviceId === 'string' && deviceId.length > 0
    ? deviceId
    : NO_ENTITY_PLACEHOLDER;
}

function pickProfileEntityId(args: {
  id: string;
  isSelf: boolean;
  selfAccountId: string | null;
  deviceEntity: Entity | null;
}): string {
  const { id, isSelf, selfAccountId, deviceEntity } = args;
  if (id === NO_ENTITY_PLACEHOLDER) return NO_ENTITY_PLACEHOLDER;
  if (isSelf && selfAccountId !== null) return selfAccountId;
  const accountIdAttr = readStringAttr(
    deviceEntity?.attributes as Record<string, unknown> | undefined,
    DeviceAttr.accountId
  );
  return accountIdAttr ?? id;
}

/**
 * Display label for a device's current profile (for host / join UI).
 *
 * Selection rules:
 * - When the device row is the current viewer, the auth context drives the lookup:
 *   signed-in → account profile (`entityId === accountId`),
 *   guest → device-local profile (`entityId === deviceId`).
 *   This matches `useProfile()` and avoids waiting on the device entity to
 *   reflect a freshly bound `accountId`.
 * - For other devices we still derive the profile id from their device entity
 *   when visible.
 */
export function useDeviceDisplayName(deviceId: string | null | undefined) {
  const { selfDeviceId, selfAccountId } = useSelfAuthIdentity();

  const id = normalizeDeviceId(deviceId);
  const isSelf = id !== NO_ENTITY_PLACEHOLDER && id === selfDeviceId;
  const skipDeviceLookup =
    id === NO_ENTITY_PLACEHOLDER || (isSelf && selfAccountId !== null);

  const deviceRes = useQuery(
    skipDeviceLookup
      ? { entityType: DEVICE_ENTITY_TYPE, limit: 0 }
      : { entityType: DEVICE_ENTITY_TYPE, entityId: id }
  );
  const deviceEntity = deviceRes.entities[0] ?? null;

  const profileEntityId = pickProfileEntityId({
    id,
    isSelf,
    selfAccountId,
    deviceEntity,
  });

  const profileRes = useQuery({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: profileEntityId,
  });
  const profileEntity = profileRes.entities[0] ?? null;

  return useMemo(() => {
    const effectiveId = id === NO_ENTITY_PLACEHOLDER ? 'unknown' : id;
    const raw = profileEntity?.attributes[ProfileAttr.displayName];
    return displayNameForDevice(raw, effectiveId);
  }, [id, profileEntity]);
}

export type CurrentMembership = {
  /** Active space id when the user is a member of a live space. */
  activeSpaceId: string | null;
  role: SpaceMembershipRole | null;
  membershipEntity: Entity | null;
  /** True until both the membership and resolved space queries have delivered. */
  isLoading: boolean;
};

function resolveCurrentMembership(args: {
  membership: Entity | null;
  hasLeft: boolean;
  spaceIdRaw: string | null;
  spaceEntity: Entity | null;
  spaceEnded: boolean;
  role: SpaceMembershipRole | null;
  isLoading: boolean;
}): CurrentMembership {
  const {
    membership,
    hasLeft,
    spaceIdRaw,
    spaceEntity,
    spaceEnded,
    role,
    isLoading,
  } = args;
  const inactive: CurrentMembership = {
    activeSpaceId: null,
    role: null,
    membershipEntity: membership,
    isLoading,
  };
  if (!membership || hasLeft || !spaceIdRaw) return inactive;
  if (!spaceEntity || spaceEnded) return inactive;
  return {
    activeSpaceId: spaceIdRaw,
    role,
    membershipEntity: membership,
    isLoading,
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

export function useCurrentMembership(): CurrentMembership {
  const deviceService = useDeviceService();
  const deviceId = deviceService.getDeviceId();

  // Memberships are keyed by `entityId === deviceId` (one row per device;
  // see `space-entities.ts`), so the current device's membership
  // is found by direct entityId lookup. Earlier versions of this hook tried
  // to scope by `patch/lastModifiedByAccountId` to gather memberships across
  // an account's devices, but that meta-key is stripped from entity
  // snapshots, so the WHERE clause never matched and the query was always
  // empty.
  const memRes = useQuery({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: deviceId,
  });

  const membership = (memRes.entities[0] ?? null) as Entity | null;

  const { spaceIdRaw, hasLeft, role } = extractMembershipState(membership);

  const spaceIdForQuery =
    spaceIdRaw && !hasLeft ? spaceIdRaw : NO_ENTITY_PLACEHOLDER;

  const spaceRes = useQuery({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceIdForQuery,
  });
  const spaceEntity = spaceRes.entities[0] ?? null;
  const spaceEnded = spaceEntity
    ? !spaceEntityIsLive(spaceEntity.attributes)
    : false;

  const isLoading = memRes.isLoading || spaceRes.isLoading;

  return useMemo(
    () =>
      resolveCurrentMembership({
        membership,
        hasLeft,
        spaceIdRaw,
        spaceEntity,
        spaceEnded,
        role,
        isLoading,
      }),
    [membership, hasLeft, spaceIdRaw, spaceEnded, spaceEntity, role, isLoading]
  );
}

function compareMembers(a: SpaceMemberRow, b: SpaceMemberRow): number {
  if (a.role === 'host' && b.role !== 'host') return -1;
  if (a.role !== 'host' && b.role === 'host') return 1;
  return a.displayName.localeCompare(b.displayName);
}

function buildMemberRow(args: {
  membership: Entity;
  deviceById: Map<string, Entity>;
  profileById: Map<string, Entity>;
  selfDeviceId: string;
  selfAccountId: string | null;
}): SpaceMemberRow {
  const { membership } = args;
  const roleRaw = membership.attributes[SpaceMembershipAttr.role];
  const role: 'host' | 'guest' = roleRaw === 'host' ? 'host' : 'guest';
  return {
    deviceId: membership.entityId,
    ...devicePresentation({
      deviceId: membership.entityId,
      deviceById: args.deviceById,
      profileById: args.profileById,
      selfDeviceId: args.selfDeviceId,
      selfAccountId: args.selfAccountId,
    }),
    role,
    peerRoomId: readStringAttr(
      membership.attributes,
      SpaceMembershipAttr.peerId
    ),
    peerPublicKeyB64: readStringAttr(
      membership.attributes,
      SpaceMembershipAttr.peerPublicKey
    ),
  };
}

export function useSpaceMembers(spaceId: string | undefined) {
  const { selfDeviceId, selfAccountId } = useSelfAuthIdentity();

  const sid =
    typeof spaceId === 'string' && spaceId.length > 0
      ? spaceId
      : NO_ENTITY_PLACEHOLDER;

  const membersRes = useQuery({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    where: {
      type: 'and',
      clauses: [
        { type: '=', attribute: SpaceMembershipAttr.spaceId, value: sid },
        { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt },
      ],
    },
  });

  const memberDeviceIds = useMemo(() => {
    const ids = (membersRes.entities ?? []).map((e) => e.entityId);
    return ids.length > 0 ? ids : [selfDeviceId];
  }, [membersRes.entities, selfDeviceId]);

  const { deviceById, profileById } = useDeviceProfileEntities(memberDeviceIds);

  const { entity: selfAccountProfile } = useSelfAccountProfile(selfAccountId);

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
          deviceById,
          profileById: augmented,
          selfDeviceId,
          selfAccountId,
        })
    );
    rows.sort(compareMembers);
    return rows;
  }, [
    membersRes.entities,
    deviceById,
    profileById,
    selfAccountProfile,
    selfDeviceId,
    selfAccountId,
  ]);

  return { members };
}
