import {
  assertRoomModuleName,
  type RoomModule,
  type RoomState,
} from '@pkgs/room';
import type { Message } from '@pkgs/message';

import type { GameClientDefinition, GameDefinition } from './game';
import type { GamePlugin, GamePluginShared } from './game-plugin';
import { SPACE_ROOM_MODULE_NAME } from './space-room-module-name';
import { createSpaceModule } from './space-module';

function assertUniquePluginIds(
  plugins: readonly { readonly id: string }[]
): void {
  const seen = new Set<string>();
  for (const plugin of plugins) {
    if (seen.has(plugin.id)) {
      throw new Error(`loadGamePlugins: duplicate game id ${plugin.id}`);
    }
    seen.add(plugin.id);
  }
}

function assertPluginIdsMatch(
  plugins: readonly { readonly id: string }[],
  defs: readonly { id: string }[],
  side: 'shared' | 'client'
): void {
  for (let i = 0; i < plugins.length; i += 1) {
    const plugin = plugins[i];
    const def = defs[i];
    if (plugin === undefined || def === undefined) continue;
    if (plugin.id !== def.id) {
      throw new Error(
        `loadGamePlugins: plugin id "${plugin.id}" does not match loaded ${side} definition id "${def.id}"`
      );
    }
  }
}

/**
 * Resolve every plugin's shared `GameDefinition` in parallel. Validates that
 * plugin ids are unique and each loaded definition's id matches the plugin
 * declaration (catches drift between the plugin entry and the loaded module).
 */
export async function loadGameDefinitions(
  plugins: readonly GamePluginShared[]
): Promise<readonly GameDefinition[]> {
  assertUniquePluginIds(plugins);
  const defs = await Promise.all(plugins.map((p) => p.loadShared()));
  assertPluginIdsMatch(plugins, defs, 'shared');
  return defs;
}

/**
 * Client counterpart to {@link loadGameDefinitions}. Same validation; resolves
 * the UI half of each plugin.
 */
export async function loadGameClientDefinitions(
  plugins: readonly GamePlugin[]
): Promise<readonly GameClientDefinition[]> {
  assertUniquePluginIds(plugins);
  const defs = await Promise.all(plugins.map((p) => p.loadClient()));
  assertPluginIdsMatch(plugins, defs, 'client');
  return defs;
}

/**
 * Compose the canonical space `SpaceModule` from already-loaded game
 * definitions. Use after {@link loadGameDefinitions} on the server, or after
 * the bootstrap helper resolves on the client.
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
