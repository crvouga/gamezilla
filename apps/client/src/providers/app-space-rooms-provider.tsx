import { RoomTransportFactoryProvider } from '@libs/spaces/client/room/room-transport-factory';
import { SpaceOpenRoomsProvider } from '@libs/spaces/client/room/space-open-rooms-context';
import type { ReactNode } from 'react';

/**
 * Meet-style room WebSockets: one connection per locally-open space.
 * Must sit under open-spaces, auth, Kv, sync engine, and SpaceModuleProvider.
 * Transport factory defaults to WebSocket; `@libs/sim` can inject loopback.
 */
export function AppSpaceRoomsProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <RoomTransportFactoryProvider>
      <SpaceOpenRoomsProvider>{children}</SpaceOpenRoomsProvider>
    </RoomTransportFactoryProvider>
  );
}
