/**
 * `SpaceDebugModal` — developer-facing inspector for the space detail screen.
 */

import { useAuth, type AuthState } from '@gamezilla/client/auth/auth-context';
import { useDeviceService } from '@gamezilla/client/runtime/runtime-hooks';
import { JsonView, ResponsiveSurface } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import type { SpaceRoomUiState } from './use-space-room';
import type { useCurrentSpaces, useSpace } from './use-spaces';
import type { SpaceMemberRow } from './types';

type Space = ReturnType<typeof useSpace>;
type CurrentSpacesState = ReturnType<typeof useCurrentSpaces>;

type SpaceDebugPayload = {
  self: {
    deviceId: string;
    accountId: AuthState['accountId'];
    myId: AuthState['myId'];
    isAuthenticated: AuthState['isAuthenticated'];
    session: AuthState['session'];
    providers: AuthState['providers'];
  };
  route: { spaceId: string | null };
  space: {
    title: Space['title'];
    customTitle: Space['customTitle'];
    hostId: Space['hostId'];
    hostDisplayName: Space['hostDisplayName'];
    live: Space['live'];
    createdAt: Space['createdAt'];
    endedAt: Space['endedAt'];
    isLoading: Space['isLoading'];
    entity: Space['space'];
  };
  currentSpaces: {
    entries: CurrentSpacesState['entries'];
    isLoading: CurrentSpacesState['isLoading'];
  };
  members: SpaceMemberRow[];
  room: {
    roomActive: boolean;
    isSynced: boolean;
    count: number;
    selectedGame: SpaceRoomUiState['selectedGame'];
  };
};

function buildPayload(args: {
  selfDeviceId: string;
  auth: AuthState;
  spaceId: string | undefined;
  space: Space;
  currentSpaces: CurrentSpacesState;
  members: SpaceMemberRow[];
  room: SpaceRoomUiState;
}): SpaceDebugPayload {
  const { selfDeviceId, auth, spaceId, space, currentSpaces, members, room } =
    args;
  return {
    self: {
      deviceId: selfDeviceId,
      accountId: auth.accountId,
      myId: auth.myId,
      isAuthenticated: auth.isAuthenticated,
      session: auth.session,
      providers: auth.providers,
    },
    route: { spaceId: spaceId ?? null },
    space: {
      title: space.title,
      customTitle: space.customTitle,
      hostId: space.hostId,
      hostDisplayName: space.hostDisplayName,
      live: space.live,
      createdAt: space.createdAt,
      endedAt: space.endedAt,
      isLoading: space.isLoading,
      entity: space.space,
    },
    currentSpaces: {
      entries: currentSpaces.entries,
      isLoading: currentSpaces.isLoading,
    },
    members,
    room: {
      roomActive: room.roomActive,
      isSynced: room.isSynced,
      count: room.count,
      selectedGame: room.selectedGame,
    },
  };
}

export type SpaceDebugModalProps = {
  visible: boolean;
  onClose: () => void;
  spaceId: string | undefined;
  space: Space;
  currentSpaces: CurrentSpacesState;
  members: SpaceMemberRow[];
  room: SpaceRoomUiState;
};

export function SpaceDebugModal({
  visible,
  onClose,
  spaceId,
  space,
  currentSpaces,
  members,
  room,
}: SpaceDebugModalProps) {
  const deviceService = useDeviceService();
  const auth = useAuth();
  const selfDeviceId = deviceService.getDeviceId();
  const { height: windowHeight } = useWindowDimensions();
  const treeMaxHeight = Math.round(windowHeight * 0.65);

  const payload = useMemo(
    () =>
      buildPayload({
        selfDeviceId,
        auth,
        spaceId,
        space,
        currentSpaces,
        members,
        room,
      }),
    [auth, currentSpaces, members, room, selfDeviceId, space, spaceId]
  );

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>Space debug</Trans>}
      maxWidth={720}
    >
      <JsonView
        label={<Trans>space-screen.debug</Trans>}
        value={payload}
        initialExpandDepth={2}
        maxHeight={treeMaxHeight}
      />
    </ResponsiveSurface>
  );
}
