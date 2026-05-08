import { ActiveSpace } from '@gamezilla/client/spaces/active-space';
import { SpaceDebugModal } from '@gamezilla/client/spaces/space-debug-modal';
import { SpaceJoinPrompt } from '@gamezilla/client/spaces/space-join-prompt';
import { SpaceLoadingScreen } from '@gamezilla/client/spaces/space-loading-screen';
import { SpaceRoomProvider } from '@gamezilla/client/spaces/space-room-context';
import { useAutoLeaveIfEnded } from '@gamezilla/client/spaces/use-auto-leave-if-ended';
import { useCurrentSpaceIds } from '@gamezilla/client/spaces/use-current-space-ids';
import { useCurrentSpaceRole } from '@gamezilla/client/spaces/use-current-space-role';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';

/** Route entry point — reads `id` from the route and dispatches to atoms. */
export function SpaceDetailScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = typeof id === 'string' ? id : '';

  const { isLoading } = useCurrentSpaceIds();
  const role = useCurrentSpaceRole(spaceId);
  const inThisSpace = role !== null;

  useAutoLeaveIfEnded(spaceId);

  const [debugOpen, setDebugOpen] = useState(false);
  const openDebug = () => setDebugOpen(true);
  const closeDebug = () => setDebugOpen(false);

  if (spaceId.length === 0 || isLoading) {
    return <SpaceLoadingScreen />;
  }

  return (
    <SpaceRoomProvider spaceId={spaceId}>
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
    </SpaceRoomProvider>
  );
}
