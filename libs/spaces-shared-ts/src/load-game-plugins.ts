import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomModule, RoomState } from '@pkgs/room-root-shared-ts/types';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import type { GameDefinition } from './game';
import { gameModules } from './game-modules';
import {
  createSpaceModule,
  type SpaceModule,
  type SpaceModulePorts,
} from './space-module';
import { SPACE_ROOM_MODULE_NAME } from './space-room-module-name';

/** Fail fast when the composition-root registry has duplicate game ids. */
export function assertGameRegistry(
  defs: readonly { readonly id: string }[]
): void {
  const seen = new Set<string>();
  for (const def of defs) {
    if (seen.has(def.id)) {
      throw new Error(`game registry: duplicate game id ${def.id}`);
    }
    seen.add(def.id);
  }
}

/** What the client registry checks of a game: its id and what it offers. */
type RegisteredShared = {
  readonly id: string;
  readonly registration?: {
    readonly capabilities: { readonly puzzles?: unknown };
  };
};

/**
 * Keep the client registry in step with the games: one client per
 * game, the same id, the same order, and a puzzles part exactly for a game
 * offering puzzles. Each failure says which entry to fix.
 */
export function assertMatchingGameIds(
  shared: readonly RegisteredShared[],
  client: readonly { readonly id: string; readonly puzzles?: unknown }[]
): void {
  const clientIds = new Set(client.map((c) => c.id));
  const sharedIds = new Set(shared.map((s) => s.id));
  for (const [index, game] of shared.entries())
    if (!clientIds.has(game.id))
      throw new Error(
        `game registry: "${game.id}" is in GAME_DEFINITIONS but has no client — add its defineGameClient(...) value to GAME_CLIENT_DEFINITIONS at index ${String(index)}`
      );
  for (const game of client)
    if (!sharedIds.has(game.id))
      throw new Error(
        `game registry: client "${game.id}" has no game — register its defineGame(...) value in GAME_DEFINITIONS, or give its defineGameClient the shared definition of the game it shows`
      );
  for (const [index, game] of shared.entries()) {
    const shown = client[index];
    if (shown !== undefined && shown.id !== game.id)
      throw new Error(
        `game registry: GAME_CLIENT_DEFINITIONS[${String(index)}] is "${shown.id}" but GAME_DEFINITIONS[${String(index)}] is "${game.id}" — list the clients in the order of GAME_DEFINITIONS`
      );
    if (shown === undefined) continue;
    const offered = game.registration?.capabilities.puzzles !== undefined;
    if (offered && shown.puzzles === undefined)
      throw new Error(
        `game registry: "${game.id}" offers puzzles but GAME_CLIENT_DEFINITIONS[${String(index)}] has no puzzles part — give its defineGameClient a puzzles part (its board), made with this definition as its shared`
      );
    if (!offered && shown.puzzles !== undefined)
      throw new Error(
        `game registry: GAME_CLIENT_DEFINITIONS[${String(index)}] ("${game.id}") has a puzzles part but GAME_DEFINITIONS[${String(index)}] offers no puzzles — register the definition its client was made with`
      );
  }
}

/**
 * Compose the canonical space `SpaceModule` from game definitions.
 */
export function composeSpaceRoomModule(
  games: readonly GameDefinition[],
  ports: SpaceModulePorts
): SpaceModule {
  return createSpaceModule(
    assertRoomModuleName(SPACE_ROOM_MODULE_NAME),
    games,
    ports
  );
}

/**
 * Convenience for the Durable Object adapter: returns the module list passed
 * to `createDurableObjectAdapter({ modules })`. The room decides as the
 * authority; a device composes its prediction with `composeSpaceRoomModule`.
 */
export function composeRoomModules(
  games: readonly GameDefinition[],
  now: () => number,
  random: Random
): readonly RoomModule<RoomState, Message, Message, string>[] {
  return [
    composeSpaceRoomModule(games, { now, random, authority: true }),
    ...gameModules(games).flatMap((game) => game.matchRooms ?? []),
  ];
}
