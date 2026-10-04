/** @jsxImportSource solid-js */
/**
 * Spaces' room wiring: the transport the shell injected, plus the open-rooms
 * registry every space screen and the miniplayer read.
 */

import { useClientEnv } from '@libs/app-client/client-env-context';
import type { JSX } from 'solid-js';
import { RoomTransportFactoryProvider } from './room-transport-factory';
import { SpaceOpenRoomsProvider } from './space-open-rooms-context';

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
