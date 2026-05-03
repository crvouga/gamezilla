import { useSpaceActions } from '@gamezilla/client/spaces/space-actions';
import { isSpaceMiniplayerHidden } from '@gamezilla/client/spaces/space-miniplayer-layout';
import type { SpaceMiniplayerModel } from '@gamezilla/client/spaces/space-miniplayer-model-types';
import {
  useCurrentMembership,
  useSpace,
  useSpaceMembers,
} from '@gamezilla/client/spaces/use-spaces';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

export type { SpaceMiniplayerModel } from '@gamezilla/client/spaces/space-miniplayer-model-types';

export function useSpaceMiniplayerModel(): SpaceMiniplayerModel {
  const pathname = usePathname();
  const current = useCurrentMembership();
  const activeSpaceId = current.activeSpaceId;
  const space = useSpace(activeSpaceId ?? undefined);
  const { members } = useSpaceMembers(activeSpaceId ?? undefined);
  const hostLabel = space.hostDisplayName;
  const { endSpace, leaveSpace } = useSpaceActions();
  const router = useRouter();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const rawPath = pathname.split('?')[0] ?? '';
  const onOpenSpace = useCallback(() => {
    if (!activeSpaceId) return;
    router.push({ pathname: '/space/[id]', params: { id: activeSpaceId } });
  }, [activeSpaceId, router]);
  const onConfirmEnd = useCallback(() => {
    setConfirmEnd(false);
    if (activeSpaceId) void endSpace(activeSpaceId);
  }, [activeSpaceId, endSpace]);
  const onConfirmLeave = useCallback(() => {
    setConfirmLeave(false);
    void leaveSpace();
  }, [leaveSpace]);

  if (
    isSpaceMiniplayerHidden({
      rawPath,
      activeSpaceId,
    })
  ) {
    return { visible: false };
  }

  const hostId = space.hostId ?? '';
  const hostAvatarConfig =
    members.find((m) => m.deviceId === hostId)?.avatarConfig ?? null;
  const membersForStack = hostId
    ? members.filter((m) => m.deviceId !== hostId)
    : members;

  return {
    visible: true,
    spaceTitle: space.title,
    hostId,
    hostLabel,
    hostAvatarConfig,
    membersForStack,
    memberCount: members.length,
    isHost: current.role === 'host',
    onOpenSpace,
    onRequestEnd: () => setConfirmEnd(true),
    onRequestLeave: () => setConfirmLeave(true),
    confirmEnd,
    confirmLeave,
    onCloseEnd: () => setConfirmEnd(false),
    onCloseLeave: () => setConfirmLeave(false),
    onConfirmEnd,
    onConfirmLeave,
  };
}
