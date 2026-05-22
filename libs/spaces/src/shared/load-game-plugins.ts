import {
  assertRoomModuleName,
  type RoomModule,
  type RoomState,
} from '@pkgs/room';
import type { Message } from '@pkgs/message';

import type { GameDefinition } from './game';
import { SPACE_ROOM_MODULE_NAME } from './space-room-module-name';
import { createSpaceModule } from './space-module';

/** Fail fast when the composition-root registry has duplicate game ids. */
export function assertGameRegistry(defs: readonly { readonly id: string }[]): void {
  const seen = new Set<string>();
  for (const def of defs) {
    if (seen.has(def.id)) {
      throw new Error(`game registry: duplicate game id ${def.id}`);
    }
    seen.add(def.id);
  }
}

/** Keep shared and client registries aligned (same ids, same order). */
export function assertMatchingGameIds(
  shared: readonly { readonly id: string }[],
  client: readonly { readonly id: string }[]
): void {
  if (shared.length !== client.length) {
    throw new Error(
      `game registry: shared (${shared.length}) and client (${client.length}) length mismatch`
    );
  }
  for (let i = 0; i < shared.length; i += 1) {
    const s = shared[i];
    const c = client[i];
    if (s === undefined || c === undefined) continue;
    if (s.id !== c.id) {
      throw new Error(
        `game registry: shared id "${s.id}" does not match client id "${c.id}" at index ${i}`
      );
    }
  }
}

/**
 * Compose the canonical space `SpaceModule` from game definitions.
 */
export function composeSpaceRoomModule(
  games: readonly GameDefinition[]
): RoomModule<RoomState, Message, Message, string> {
  return createSpaceModule(assertRoomModuleName(SPACE_ROOM_MODULE_NAME), games);
}

/**
 * Convenience for the Durable Object adapter: returns the module list passed
 * to `createDurableObjectAdapter({ modules })`.
 */
export function composeRoomModules(
  games: readonly GameDefinition[]
): readonly [RoomModule<RoomState, Message, Message, string>] {
  return [composeSpaceRoomModule(games)] as const;
}
