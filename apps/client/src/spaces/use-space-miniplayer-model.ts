import { useMyId } from '@gamezilla/client/auth/auth-context';
import { useProfileEntities } from '@gamezilla/client/profile/use-profile-entities';
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
import { useLingui } from '@lingui/react/macro';
import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { useSpaceActions } from './space-actions';
import { useCurrentSpaces, type CurrentSpaceEntry } from './use-spaces';

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
  const raw = attrs?.[ProfileAttr.displayName];
  const displayName =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '';
  return {
    displayName,
    avatarConfig: parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig),
  };
}

function useSpaceMiniplayerGuestIndex(spaceIds: string[]) {
  const guestsRes = useQuery({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    // select: {
    //   [SpaceMembershipAttr.spaceId]: String,
    //   [SpaceMembershipAttr.guestId]: String,
    //   [SpaceMembershipAttr.joinedAt]: Date,
    //   [SpaceMembershipAttr.leftAt]: Date,
    // },
    where: {
      type: 'and',
      clauses: [
        {
          type: 'in',
          attribute: SpaceMembershipAttr.spaceId,
          values: spaceIds,
        },
        {
          type: 'not_exists',
          attribute: SpaceMembershipAttr.leftAt,
        },
      ],
    },
    limit: spaceIds.length,
  });

  const guestsBySpace = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of guestsRes.entities ?? []) {
      const sid = readStringAttr(e.attributes, SpaceMembershipAttr.spaceId);
      const gid = readStringAttr(e.attributes, SpaceMembershipAttr.guestId);
      if (!sid || !gid) continue;
      const list = m.get(sid) ?? [];
      list.push(gid);
      m.set(sid, list);
    }
    return m;
  }, [guestsRes.entities]);

  return { guestsBySpace, guestsRes };
}

type MiniplayerT = (
  literals: TemplateStringsArray,
  ...values: unknown[]
) => string;

function buildMiniplayerItem(
  ent: CurrentSpaceEntry,
  ctx: {
    profileById: Map<string, Entity>;
    guestsBySpace: Map<string, string[]>;
    t: MiniplayerT;
    router: ReturnType<typeof useRouter>;
    confirmEndId: string | null;
    confirmLeaveId: string | null;
    setConfirmEndId: (id: string | null) => void;
    setConfirmLeaveId: (id: string | null) => void;
    endSpace: (id: string) => void | Promise<void>;
    leaveSpace: (id: string) => void | Promise<void>;
  }
): SpaceMiniplayerItemModel {
  const se = ent.spaceEntity;
  const hostId = readStringAttr(se?.attributes, SpaceAttr.hostId) ?? '';
  const customTitle = readStringAttr(se?.attributes, SpaceAttr.title);
  const hostPres =
    hostId.length > 0
      ? profilePresentation(ctx.profileById, hostId)
      : { displayName: '', avatarConfig: null };
  const spaceTitle = customTitle ?? ctx.t`${hostPres.displayName}'s space`;
  const guestIds = ctx.guestsBySpace.get(ent.spaceId) ?? [];
  let memberCount = hostId ? 1 : 0;
  const guestSet = new Set(guestIds);
  memberCount += [...guestSet].filter((g) => g !== hostId).length;

  return {
    spaceId: ent.spaceId,
    spaceTitle,
    hostId,
    hostLabel: hostPres.displayName,
    hostAvatarConfig: hostPres.avatarConfig,
    memberCount,
    isHost: ent.role === 'host',
    onOpenSpace: () => {
      ctx.router.push({
        pathname: '/space/[id]',
        params: { id: ent.spaceId },
      });
    },
    onRequestEnd: () => ctx.setConfirmEndId(ent.spaceId),
    onRequestLeave: () => ctx.setConfirmLeaveId(ent.spaceId),
    confirmEnd: ctx.confirmEndId === ent.spaceId,
    confirmLeave: ctx.confirmLeaveId === ent.spaceId,
    onCloseEnd: () => ctx.setConfirmEndId(null),
    onCloseLeave: () => ctx.setConfirmLeaveId(null),
    onConfirmEnd: () => {
      ctx.setConfirmEndId(null);
      void ctx.endSpace(ent.spaceId);
    },
    onConfirmLeave: () => {
      ctx.setConfirmLeaveId(null);
      void ctx.leaveSpace(ent.spaceId);
    },
  };
}

function useSpaceMiniplayerItemsList(args: {
  entries: CurrentSpaceEntry[];
  profileById: Map<string, Entity>;
  guestsBySpace: Map<string, string[]>;
  t: MiniplayerT;
  router: ReturnType<typeof useRouter>;
  confirmEndId: string | null;
  confirmLeaveId: string | null;
  setConfirmEndId: (id: string | null) => void;
  setConfirmLeaveId: (id: string | null) => void;
  endSpace: (id: string) => void | Promise<void>;
  leaveSpace: (id: string) => void | Promise<void>;
}): SpaceMiniplayerItemModel[] {
  return useMemo(
    () =>
      args.entries.map((ent) =>
        buildMiniplayerItem(ent, {
          profileById: args.profileById,
          guestsBySpace: args.guestsBySpace,
          t: args.t,
          router: args.router,
          confirmEndId: args.confirmEndId,
          confirmLeaveId: args.confirmLeaveId,
          setConfirmEndId: args.setConfirmEndId,
          setConfirmLeaveId: args.setConfirmLeaveId,
          endSpace: args.endSpace,
          leaveSpace: args.leaveSpace,
        })
      ),
    [
      args.entries,
      args.profileById,
      args.guestsBySpace,
      args.t,
      args.router,
      args.confirmEndId,
      args.confirmLeaveId,
      args.setConfirmEndId,
      args.setConfirmLeaveId,
      args.endSpace,
      args.leaveSpace,
    ]
  );
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

  const { guestsBySpace, guestsRes } = useSpaceMiniplayerGuestIndex(spaceIds);

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

  const items = useSpaceMiniplayerItemsList({
    entries,
    profileById,
    guestsBySpace,
    t,
    router,
    confirmEndId,
    confirmLeaveId,
    setConfirmEndId,
    setConfirmLeaveId,
    endSpace,
    leaveSpace,
  });

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
