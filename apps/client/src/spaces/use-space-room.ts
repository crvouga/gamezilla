import {
  useConfigService,
  useDeviceService,
  useSecureStorage,
} from '@gamezilla/client/runtime/runtime-hooks';
import { useMemo } from 'react';

import { computeSpaceRoomBootstrap } from './space-room-bootstrap';
import { useSpaceRoomConnection } from './use-space-room-connection';
import { useSpaceRoomCounterControls } from './use-space-room-counter-controls';
import { useCurrentMembership, useSpace, useSpaceMembers } from './use-spaces';

export function useSpaceRoom(spaceId: string | undefined): {
  count: number;
  increment: () => void;
  decrement: () => void;
  isSynced: boolean;
  roomActive: boolean;
} {
  const space = useSpace(spaceId);
  const { members } = useSpaceMembers(spaceId);
  const current = useCurrentMembership();
  const configService = useConfigService();
  const deviceService = useDeviceService();
  const storage = useSecureStorage();
  const selfDeviceId = deviceService.getDeviceId();
  const role =
    current.activeSpaceId === spaceId ? current.role : null;
  const bootstrap = useMemo(
    () =>
      computeSpaceRoomBootstrap({
        spaceId,
        spaceLive: space.live,
        role,
        phantomPeerId: space.phantomPeerId,
        phantomPublicKey: space.phantomPublicKey,
        members,
        hostDeviceId: space.hostId,
        selfDeviceId,
        membershipEntity: current.membershipEntity,
      }),
    [
      spaceId,
      space.live,
      space.phantomPeerId,
      space.phantomPublicKey,
      space.hostId,
      role,
      members,
      selfDeviceId,
      current.membershipEntity,
    ]
  );
  const { room, roomRef } = useSpaceRoomConnection(
    bootstrap,
    configService,
    storage,
    selfDeviceId
  );
  const controls = useSpaceRoomCounterControls(room, roomRef);
  return {
    ...controls,
    roomActive: room !== null,
  };
}
