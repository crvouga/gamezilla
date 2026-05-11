import { chessGameShared } from '@gamezilla/chess/shared/chess-game';
import type { GameDefinition } from '@gamezilla/spaces/shared/game';
import { createSpaceModule } from '@gamezilla/spaces/shared/space-module';

/**
 * Single, authoritative list of every playable game in the app — registered
 * once here so the server-side composition root (`@gamezilla/api`) and the
 * client-side bootstrap (`@gamezilla/app/client/games-bootstrap`) cannot
 * drift. If they did, the client would optimistically dispatch commands the
 * server's composed router refuses, or vice versa.
 *
 * Adding a new game = drop its `gameShared` into this array. The matching
 * client half lives next to it in `../client/games-bootstrap.tsx` so the two
 * halves of a game move through code review together.
 */
export const APP_GAMES_SHARED: readonly GameDefinition[] = [chessGameShared];

/**
 * Pre-composed `SpaceModule` for the Space Durable Object and the client-side
 * `SpaceModuleProvider`. `createSpaceModule` is pure (it just composes
 * routers and reducers), so eager construction at module load is safe and
 * gives every consumer a referentially-stable singleton — no `useMemo`
 * ceremony needed on the client.
 */
export const APP_SPACE_MODULE = createSpaceModule(APP_GAMES_SHARED);
