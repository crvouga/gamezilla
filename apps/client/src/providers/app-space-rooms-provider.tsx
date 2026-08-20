import { useClientEnv } from '@apps/client/product/client-env-provider';
import { SpaceOpenRoomsProvider } from '@libs/spaces/public/room/space-open-rooms-context';
import { RoomTransportFactoryProvider } from '@libs/spaces/root/client/room/room-transport-factory';
import type { ReactNode } from 'react';

export function AppSpaceRoomsProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const { room } = useClientEnv();
  return (
    <RoomTransportFactoryProvider createTransport={room}>
      <SpaceOpenRoomsProvider>{children}</SpaceOpenRoomsProvider>
    </RoomTransportFactoryProvider>
  );
}
