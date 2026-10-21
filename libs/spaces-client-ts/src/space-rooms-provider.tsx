/** @jsxImportSource solid-js */
/**
 * Spaces' room wiring: the transport the shell injected, plus the open-rooms
 * registry every space screen and the miniplayer read.
 */

import { useClientEnv } from '@libs/app-root-client-ts/client-env-context';
import type { JSX } from 'solid-js';
import { HostingAccount } from './hosting-invite';
import { RoomTransportFactoryProvider } from './room-transport-factory';
import { SpaceOpenRoomsProvider } from './space-open-rooms-context';
import { SpacePresenceProbes } from './space-presence-probes';

export function AppSpaceRoomsProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  return (
    <RoomTransportFactoryProvider createTransport={env.room}>
      <SpaceOpenRoomsProvider>
        <HostingAccount>
          <SpacePresenceProbes />
          {props.children}
        </HostingAccount>
      </SpaceOpenRoomsProvider>
    </RoomTransportFactoryProvider>
  );
}
