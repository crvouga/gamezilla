/** @jsxImportSource solid-js */
/**
 * Spaces' room wiring: the transport the shell injected, plus the open-rooms
 * registry every space screen and the miniplayer read.
 */

import { useClientEnv } from '@libs/client-app/shell/client-env-context';
import { SpaceOpenRoomsProvider } from '@libs/spaces/public/room/space-open-rooms-context';
import { RoomTransportFactoryProvider } from '@libs/spaces/root/client/room/room-transport-factory';
import type { JSX } from 'solid-js';

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
