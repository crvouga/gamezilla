import { ActiveSpace } from './active-space/active-space';
import { SpaceDebugModal } from './debug/space-debug-modal';
import { SpaceJoinPrompt } from './lifecycle/space-join-prompt';
import { SpaceLoadingScreen } from './space-loading-screen';
import { SpaceRoomProvider } from './room/space-room-context';
import { useAutoLeaveIfEnded } from './lifecycle/use-auto-leave-if-ended';
import { useCurrentSpaceIds } from './use-current-space-ids';
import { useCurrentSpaceRole } from './use-current-space-role';
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
