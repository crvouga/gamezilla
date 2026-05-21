import { chessGameShared } from '@libs/chess/shared/chess-game';
import { assertRoomModuleName } from '@pkgs/room';
import type { GameDefinition } from '@libs/spaces/shared/game';
import { SPACE_ROOM_MODULE_NAME } from '@libs/spaces/shared/space-room-module-name';
import { createSpaceModule } from '@libs/spaces/shared/space-module';

/**
 * Single, authoritative list of every playable game in the app — registered
 * once here so the server-side composition root (`@apps/api`) and the
 * client-side bootstrap (`apps/client/src/providers/games-bootstrap-provider.tsx`)
 * cannot drift. If they did, the client would optimistically dispatch commands
 * the server's composed router refuses, or vice versa.
 *
 * Adding a new game = drop its `gameShared` into this array and its
 * `gameClient` into `APP_GAMES_CLIENT` in the client provider so both halves
 * move through code review together.
 */
export const APP_GAMES_SHARED: readonly GameDefinition[] = [chessGameShared];

/**
 * Pre-composed `SpaceModule` for the Room Durable Object and the client-side
 * `SpaceModuleProvider`. `createSpaceModule` is pure (it just composes
 * routers and reducers), so eager construction at module load is safe and
 * gives every consumer a referentially-stable singleton — no `useMemo`
 * ceremony needed on the client.
 */
export const APP_SPACE_MODULE = createSpaceModule(
  assertRoomModuleName(SPACE_ROOM_MODULE_NAME),
  APP_GAMES_SHARED
);

/** Modules passed to `createDurableObjectAdapter({ modules })` on the API Worker. */
export const APP_ROOM_MODULES = [APP_SPACE_MODULE] as const;
