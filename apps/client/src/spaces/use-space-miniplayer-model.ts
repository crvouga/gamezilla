import { useMyId } from '@gamezilla/client/auth/auth-context';
import { useProfileEntities } from '@gamezilla/client/profile/use-profile-entities';
import { displayNameForDevice } from '@gamezilla/client/profile/device-display';
import { isSpaceMiniplayerHidden } from '@gamezilla/client/spaces/space-miniplayer-layout';
import type {
  SpaceMiniplayerItemModel,
  SpaceMiniplayerModel,
} from '@gamezilla/client/spaces/space-miniplayer-model-types';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { parseAvatarConfigAttr } from '@gamezilla/domain/profile/avatar-config';
import { ProfileAttr } from '@gamezilla/domain/profile/profile-entities';
import {
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { usePathname, useRouter } from 'expo-router';
import { useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';

import { useCurrentSpaces } from './use-spaces';
import { useSpaceActions } from './space-actions';

export type { SpaceMiniplayerModel } from '@gamezilla/client/spaces/space-miniplayer-model-types';

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

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

export function useSpaceMiniplayerModel(): SpaceMiniplayerModel {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLingui();
  const myId = useMyId();
  const { entries, isLoading } = useCurrentSpaces();
  const { endSpace, leaveSpace } = useSpaceActions();

  const [confirmEndId, setConfirmEndId] = useState<string | null>(null);
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null);

  const spaceIds = useMemo(
    () => entries.map((e) => e.spaceId).sort(),
    [entries]
  );

  const guestsRes = useQuery(
    spaceIds.length === 0
      ? { entityType: SPACE_MEMBERSHIP_ENTITY_TYPE, limit: 0 }
      : {
          entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
          where: {
            type: 'and',
            clauses: [
              {
                type: 'in',
                attribute: SpaceMembershipAttr.spaceId,
                values: spaceIds,
              },
              { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt },
            ],
          },
        }
  );

  const guestsBySpace = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of guestsRes.entities ?? []) {
      const sid = readStringAttr(
        e.attributes as Record<string, unknown>,
        SpaceMembershipAttr.spaceId
      );
      const gid = readStringAttr(
        e.attributes as Record<string, unknown>,
        SpaceMembershipAttr.guestId
      );
      if (!sid || !gid) continue;
      const list = m.get(sid) ?? [];
      list.push(gid);
      m.set(sid, list);
    }
    return m;
  }, [guestsRes.entities]);

  const profileIds = useMemo(() => {
    const s = new Set<string>();
    s.add(myId);
    for (const ent of entries) {
      const se = ent.spaceEntity;
      const hid = readStringAttr(se?.attributes, SpaceAttr.hostId);
      if (hid) s.add(hid);
      for (const gid of guestsBySpace.get(ent.spaceId) ?? []) {
        s.add(gid);
      }
    }
    return [...s];
  }, [entries, guestsBySpace, myId]);

  const { profileById } = useProfileEntities(profileIds);

  const rawPath = pathname.split('?')[0] ?? '';

  const items: SpaceMiniplayerItemModel[] = useMemo(() => {
    return entries.map((ent) => {
      const se = ent.spaceEntity;
      const hostId =
        readStringAttr(se?.attributes, SpaceAttr.hostId) ?? '';
      const customTitle = readStringAttr(se?.attributes, SpaceAttr.title);
      const hostPres =
        hostId.length > 0
          ? profilePresentation(profileById, hostId)
          : { displayName: '…', avatarConfig: null };
      const spaceTitle = customTitle ?? t`${hostPres.displayName}'s space`;
      const guestIds = guestsBySpace.get(ent.spaceId) ?? [];
      let memberCount = hostId ? 1 : 0;
      const guestSet = new Set(guestIds);
      memberCount += [...guestSet].filter((g) => g !== hostId).length;

      const onOpenSpace = () => {
        router.push({
          pathname: '/space/[id]',
          params: { id: ent.spaceId },
        });
      };

      return {
        spaceId: ent.spaceId,
        spaceTitle,
        hostId,
        hostLabel: hostPres.displayName,
        hostAvatarConfig: hostPres.avatarConfig,
        memberCount,
        isHost: ent.role === 'host',
        onOpenSpace,
        onRequestEnd: () => setConfirmEndId(ent.spaceId),
        onRequestLeave: () => setConfirmLeaveId(ent.spaceId),
        confirmEnd: confirmEndId === ent.spaceId,
        confirmLeave: confirmLeaveId === ent.spaceId,
        onCloseEnd: () => setConfirmEndId(null),
        onCloseLeave: () => setConfirmLeaveId(null),
        onConfirmEnd: () => {
          setConfirmEndId(null);
          void endSpace(ent.spaceId);
        },
        onConfirmLeave: () => {
          setConfirmLeaveId(null);
          void leaveSpace(ent.spaceId);
        },
      };
    });
  }, [
    entries,
    profileById,
    guestsBySpace,
    t,
    router,
    confirmEndId,
    confirmLeaveId,
    endSpace,
    leaveSpace,
  ]);

  if (
    isLoading ||
    guestsRes.isLoading ||
    isSpaceMiniplayerHidden({
      rawPath,
      activeSpaceCount: entries.length,
    })
  ) {
    return { visible: false };
  }

  if (items.length === 0) {
    return { visible: false };
  }

  return { visible: true, items };
}
