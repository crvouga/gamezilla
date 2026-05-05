import { useMyId } from '@gamezilla/client/auth/auth-context';
import { useProfileEntities } from '@gamezilla/client/profile/use-profile-entities';
import { displayNameForDevice } from '@gamezilla/client/profile/device-display';
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
} from '@gamezilla/domain/spaces/space-entities';
import type { Entity, PatchDbQuery } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';

import { NO_ENTITY_PLACEHOLDER } from '@gamezilla/client/spaces/spaces-internal-ids';
import type { SpaceMemberRow, SpaceView } from './types';

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

function profilePresentation(
  profileById: Map<string, Entity>,
  id: string
): { displayName: string; avatarConfig: AvatarConfig | null } {
  const profileEntity = profileById.get(id);
  const attrs = profileEntity?.attributes as
    | Record<string, unknown>
    | undefined;
  return {
    displayName: displayNameForDevice(attrs?.[ProfileAttr.displayName], id),
    avatarConfig: parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig),
  };
}

function buildSpaceView(args: {
  entity: Entity;
  profileById: Map<string, Entity>;
  t: ReturnType<typeof useLingui>['t'];
}): SpaceView {
  const { entity, t } = args;
  const customTitle = readStringAttr(entity.attributes, SpaceAttr.title);
  const hostId = readStringAttr(entity.attributes, SpaceAttr.hostId) ?? '';
  const { displayName: hostDisplayName, avatarConfig: hostAvatarConfig } =
    profilePresentation(args.profileById, hostId);
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
  const myId = useMyId();
  const { t } = useLingui();

  const spacesResult = useQuery(LIVE_SPACES_QUERY);

  const hostIds = useMemo(() => {
    const list = spacesResult.entities ?? [];
    const ids = new Set<string>();
    for (const e of list) {
      const hid = readStringAttr(e.attributes, SpaceAttr.hostId);
      if (hid) ids.add(hid);
    }
    ids.add(myId);
    return [...ids];
  }, [spacesResult.entities, myId]);

  const { profileById } = useProfileEntities(hostIds);

  const spaces: SpaceView[] = useMemo(() => {
    const list = spacesResult.entities ?? [];
    return list.map((entity) =>
      buildSpaceView({
        entity,
        profileById,
        t,
      })
    );
  }, [spacesResult.entities, profileById, t]);

  return { spaces };
}

function readSpaceEntitySnapshot(entity: Entity | null): {
  customTitle: string | null;
  hostId: string | null;
  createdAt: string | null;
  live: boolean;
  endedAt: string | null;
} {
  const attrs = entity?.attributes;
  return {
    customTitle: readStringAttr(attrs, SpaceAttr.title),
    hostId: readStringAttr(attrs, SpaceAttr.hostId),
    createdAt: readStringAttr(attrs, SpaceAttr.createdAt),
    live: entity ? spaceEntityIsLive(attrs) : false,
    endedAt: readStringAttr(attrs, SpaceAttr.endedAt),
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

  const hostDisplayName = useDisplayName(snap.hostId);
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
    isLoading: spaceRes.isLoading,
  };
}

/** Profile-backed display label for any actor id. */
export function useDisplayName(id: string | null | undefined): string {
  const resolvedId =
    typeof id === 'string' && id.length > 0 ? id : NO_ENTITY_PLACEHOLDER;

  const profileRes = useQuery(
    resolvedId === NO_ENTITY_PLACEHOLDER
      ? { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
      : {
          entityType: PROFILE_ENTITY_TYPE,
          entityId: resolvedId,
        }
  );
  const profileEntity = profileRes.entities[0] ?? null;

  return useMemo(() => {
    const fallback =
      resolvedId === NO_ENTITY_PLACEHOLDER ? 'unknown' : resolvedId;
    const raw = profileEntity?.attributes[ProfileAttr.displayName];
    return displayNameForDevice(raw, fallback);
  }, [resolvedId, profileEntity]);
}

export type CurrentSpaceEntry = {
  spaceId: string;
  role: 'host' | 'guest';
  spaceEntity: Entity | null;
};

function useCurrentSpacesQueries(myId: string) {
  const hostedRes = useQuery({
    entityType: SPACE_ENTITY_TYPE,
    where: {
      type: 'and',
      clauses: [
        { type: '=', attribute: SpaceAttr.hostId, value: myId },
        { type: 'not_exists', attribute: SpaceAttr.endedAt },
      ],
    },
    orderBy: [{ attribute: SpaceAttr.createdAt, direction: 'desc' }],
  });

  const guestMemRes = useQuery({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    where: {
      type: 'and',
      clauses: [
        { type: '=', attribute: SpaceMembershipAttr.guestId, value: myId },
        { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt },
      ],
    },
  });

  const guestSpaceIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of guestMemRes.entities ?? []) {
      const sid = readStringAttr(
        e.attributes as Record<string, unknown>,
        SpaceMembershipAttr.spaceId
      );
      if (sid) ids.push(sid);
    }
    return [...new Set(ids)].sort();
  }, [guestMemRes.entities]);

  const guestSpacesRes = useQuery(
    guestSpaceIds.length === 0
      ? { entityType: SPACE_ENTITY_TYPE, limit: 0 }
      : { entityType: SPACE_ENTITY_TYPE, entityId: guestSpaceIds }
  );

  const guestSpaceById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const e of guestSpacesRes.entities ?? []) {
      m.set(e.entityId, e);
    }
    return m;
  }, [guestSpacesRes.entities]);

  return {
    hostedRes,
    guestMemRes,
    guestSpaceIds,
    guestSpacesRes,
    guestSpaceById,
  };
}

export function useCurrentSpaces(): {
  entries: CurrentSpaceEntry[];
  isLoading: boolean;
} {
  const myId = useMyId();
  const {
    hostedRes,
    guestMemRes,
    guestSpaceIds,
    guestSpacesRes,
    guestSpaceById,
  } = useCurrentSpacesQueries(myId);

  const entries = useMemo((): CurrentSpaceEntry[] => {
    const bySpace = new Map<string, CurrentSpaceEntry>();
    for (const e of hostedRes.entities ?? []) {
      bySpace.set(e.entityId, {
        spaceId: e.entityId,
        role: 'host',
        spaceEntity: e,
      });
    }
    for (const sid of guestSpaceIds) {
      if (bySpace.has(sid)) continue;
      const spaceEntity = guestSpaceById.get(sid) ?? null;
      if (spaceEntity && !spaceEntityIsLive(spaceEntity.attributes)) {
        continue;
      }
      bySpace.set(sid, { spaceId: sid, role: 'guest', spaceEntity });
    }
    return [...bySpace.values()];
  }, [hostedRes.entities, guestSpaceIds, guestSpaceById]);

  const isLoading =
    hostedRes.isLoading || guestMemRes.isLoading || guestSpacesRes.isLoading;

  return { entries, isLoading };
}

function compareMembers(a: SpaceMemberRow, b: SpaceMemberRow): number {
  if (a.role === 'host' && b.role !== 'host') return -1;
  if (a.role !== 'host' && b.role === 'host') return 1;
  return a.displayName.localeCompare(b.displayName);
}

export function useSpaceMembers(spaceId: string | undefined) {
  const myId = useMyId();
  const sid =
    typeof spaceId === 'string' && spaceId.length > 0
      ? spaceId
      : NO_ENTITY_PLACEHOLDER;

  const spaceRes = useQuery(
    sid === NO_ENTITY_PLACEHOLDER
      ? { entityType: SPACE_ENTITY_TYPE, limit: 0 }
      : { entityType: SPACE_ENTITY_TYPE, entityId: sid }
  );
  const spaceEntity = spaceRes.entities[0] ?? null;
  const hostId = readStringAttr(spaceEntity?.attributes, SpaceAttr.hostId);

  const membersRes = useQuery(
    sid === NO_ENTITY_PLACEHOLDER
      ? { entityType: SPACE_MEMBERSHIP_ENTITY_TYPE, limit: 0 }
      : {
          entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
          where: {
            type: 'and',
            clauses: [
              { type: '=', attribute: SpaceMembershipAttr.spaceId, value: sid },
              { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt },
            ],
          },
        }
  );

  const guestIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of membersRes.entities ?? []) {
      const gid = readStringAttr(
        e.attributes as Record<string, unknown>,
        SpaceMembershipAttr.guestId
      );
      if (gid) ids.push(gid);
    }
    return ids;
  }, [membersRes.entities]);

  const memberIdsForProfiles = useMemo(() => {
    const s = new Set<string>();
    if (hostId) s.add(hostId);
    for (const g of guestIds) s.add(g);
    if (myId) s.add(myId);
    return [...s];
  }, [hostId, guestIds, myId]);

  const { profileById } = useProfileEntities(memberIdsForProfiles);

  const members: SpaceMemberRow[] = useMemo(() => {
    if (!hostId || sid === NO_ENTITY_PLACEHOLDER) return [];
    const rows: SpaceMemberRow[] = [];
    rows.push({
      memberId: hostId,
      ...profilePresentation(profileById, hostId),
      role: 'host',
    });
    for (const gid of guestIds) {
      if (gid === hostId) continue;
      rows.push({
        memberId: gid,
        ...profilePresentation(profileById, gid),
        role: 'guest',
      });
    }
    rows.sort(compareMembers);
    return rows;
  }, [hostId, guestIds, profileById, sid]);

  return { members };
}
