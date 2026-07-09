import { ActiveSpace } from './active-space/active-space';
import { SpaceDebugModal } from './debug/space-debug-modal';
import { SpaceJoinPrompt } from './lifecycle/space-join-prompt';
import { SpaceLoadingScreen } from './space-loading-screen';
import { SpacesNavProvider } from './nav/spaces-nav-context';
import { SpaceRoomProvider } from './room/space-room-context';
import { useAutoLeaveIfEnded } from './lifecycle/use-auto-leave-if-ended';
import { useCurrentSpaceIds } from './use-current-space-ids';
import { useCurrentSpaceRole } from './use-current-space-role';
import {
  isReplicationHost,
  useReplicationIdentityIds,
} from './use-replication-identity-ids';
import { useSpaceColumn, SpaceField } from './use-space-column';
import { useState, type ReactNode } from 'react';
import {
  useSpaceRouteId,
  useStripRedundantSpaceRouteSearchParams,
} from './space-routes';

/** Route entry point — reads `id` from the route and dispatches to atoms. */
export function SpaceDetailScreen(): ReactNode {
  const spaceId = useSpaceRouteId();

  useStripRedundantSpaceRouteSearchParams(spaceId);

  if (spaceId.length === 0) {
    return <SpaceLoadingScreen />;
  }

  return (
    <SpacesNavProvider>
      <SpaceRoomProvider spaceId={spaceId}>
        <SpaceDetailBody spaceId={spaceId} />
      </SpaceRoomProvider>
    </SpacesNavProvider>
  );
}

type SpaceDetailBodyProps = {
  spaceId: string;
};

function SpaceDetailBody({ spaceId }: SpaceDetailBodyProps): ReactNode {
  const identityIds = useReplicationIdentityIds();
  const { isLoading } = useCurrentSpaceIds();
  const role = useCurrentSpaceRole(spaceId);
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  const isHostByEntity =
    endedAt === null && isReplicationHost(hostId, identityIds);
  const inThisSpace = role !== null || isHostByEntity;

  useAutoLeaveIfEnded(spaceId);

  const [debugOpen, setDebugOpen] = useState(false);
  const openDebug = () => setDebugOpen(true);
  const closeDebug = () => setDebugOpen(false);

  if (isLoading) {
    return <SpaceLoadingScreen />;
  }

  return (
    <>
      {inThisSpace ? (
        <ActiveSpace spaceId={spaceId} onOpenDebug={openDebug} />
      ) : (
        <SpaceJoinPrompt spaceId={spaceId} onOpenDebug={openDebug} />
      )}
      <SpaceDebugModal
        visible={debugOpen}
        onClose={closeDebug}
        spaceId={spaceId}
      />
    </>
  );
}
