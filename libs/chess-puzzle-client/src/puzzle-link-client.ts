import { PUZZLE_LINK_ROUTE } from '@libs/chess-puzzle-shared/puzzle-link';
import { defineSubClient } from '@libs/sub-client/client';
import { PuzzleLinkScreen } from './puzzle-link-screen';

/** Shared puzzle links open outside the space's game screens. */
export const PUZZLE_LINK_CLIENT = defineSubClient({
  name: 'puzzle-link',
  routes: [{ path: PUZZLE_LINK_ROUTE, component: PuzzleLinkScreen }],
});
