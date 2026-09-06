import { SpaceOpenRoomsProvider } from '@libs/spaces/public/room/space-open-rooms-context';
import { RoomTransportFactoryProvider } from '@libs/spaces/root/client/room/room-transport-factory';
import type { JSX } from 'solid-js';

import { useClientEnv } from '../client-env-context';

export function AppSpaceRoomsProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  return (
    <RoomTransportFactoryProvider createTransport={env.room}>
      <SpaceOpenRoomsProvider>{props.children}</SpaceOpenRoomsProvider>
    </RoomTransportFactoryProvider>
  );
}
