import type { ReactNode } from 'react';
import { ActiveSpace } from './active-space/active-space';
import { SpaceEndedScreen } from './join-space/space-ended-screen';
import { SpaceJoinPrompt } from './join-space/space-join-prompt';
import { SpacesNavProvider } from './nav/spaces-nav-context';
import { SpaceRoomProvider } from './room/space-room-context';
import { SpaceDetailInitialLoading } from './space-detail-initial-loading';
import { useSpaceRouteId } from './space-routes';
import { useSpacePresence } from './use-space-presence';

/** Route entry point — reads `id` from the route and dispatches to atoms. */
export function SpaceDetailScreen(): ReactNode {
  const spaceId = useSpaceRouteId();

  if (spaceId.length === 0) {
    return (
      <SpacesNavProvider>
        <SpaceDetailInitialLoading spaceId="" />
      </SpacesNavProvider>
    );
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
  const presence = useSpacePresence(spaceId);

  if (presence.status === 'loading') {
    return <SpaceDetailInitialLoading spaceId={spaceId} />;
  }

  if (presence.status === 'active') {
    return <ActiveSpace spaceId={spaceId} />;
  }

  // Presence already knows the space ended — skip join hydration so we
  // never flash / stick on a spinner after end/leave.
  if (presence.ended) {
    return <SpaceEndedScreen spaceId={spaceId} />;
  }

  return <SpaceJoinPrompt spaceId={spaceId} />;
}
