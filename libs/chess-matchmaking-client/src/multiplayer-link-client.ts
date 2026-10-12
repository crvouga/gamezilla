import { MULTIPLAYER_LINK_ROUTE } from '@libs/chess-matchmaking-shared/multiplayer-link';
import { defineSubClient } from '@libs/sub-client/client';
import { MultiplayerLinkScreen } from './multiplayer-link-screen';

/** A turn notice or a result notice opens outside the space's game screens. */
export const MULTIPLAYER_LINK_CLIENT = defineSubClient({
  name: 'multiplayer-link',
  routes: [{ path: MULTIPLAYER_LINK_ROUTE, component: MultiplayerLinkScreen }],
});
