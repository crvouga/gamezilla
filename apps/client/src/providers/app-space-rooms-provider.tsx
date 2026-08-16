import { RoomTransportFactoryProvider } from '@libs/spaces/client/room/room-transport-factory';
import { SpaceOpenRoomsProvider } from '@libs/spaces/client/room/space-open-rooms-context';
import type { ReactNode } from 'react';

import { useClientSystemResources } from './client-system-resources';

/**
 * Meet-style room connections: one connection per locally-open space.
 * Must sit under open-spaces, auth, Kv, sync engine, and SpaceModuleProvider.
 * Transport factory defaults to WebSocket; playground injects loopback via
 * {@link ClientSystemResources}.createRoomTransport.
 */
export function AppSpaceRoomsProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const { createRoomTransport } = useClientSystemResources();
  return (
    <RoomTransportFactoryProvider
      {...(createRoomTransport !== undefined
        ? { createTransport: createRoomTransport }
        : {})}
    >
      <SpaceOpenRoomsProvider>{children}</SpaceOpenRoomsProvider>
    </RoomTransportFactoryProvider>
  );
}
