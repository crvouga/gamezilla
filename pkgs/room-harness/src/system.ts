import { defineProperty } from '@pkgs/harness-shared/define-property';
import { defineSystem } from '@pkgs/harness-shared/define-system';
import { readOwner } from './game-room';
import { bootRoomHarness, ROOM_LIBRARY_PROPERTIES, roomSystemCatalog } from './boot';
import { ROOM_ARGS, ROOM_DRAW } from './args';
import type { RoomArgs } from './args';
import type { RoomHarness } from './harness';
import { serverCrashed } from './observations';
import { exampleApp } from './example-app-app';

/**
 * Once someone owns the room, ownership never moves — not across a newer
 * arrival, an app closing, or the room restarting.
 */
const ownerStable = defineProperty<RoomHarness, { owner: string | null }>({
  name: 'ownerStable',
  setup: () => ({ owner: null }),
  check: async (s, model) => {
    if (serverCrashed(s)) return model;
    const owner = readOwner(await s.kit.serverSnapshot());
    if (model.owner !== null && owner !== model.owner) {
      throw new Error(`owner moved from ${model.owner} to ${String(owner)}`);
    }
    return { owner: owner ?? model.owner };
  },
});

/** The example game room: `clientCount` devices around one room. */
export const exampleSystem = defineSystem<RoomHarness, RoomArgs>({
  name: 'room.example-app',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomHarness(session, exampleApp, args),
  ...roomSystemCatalog(exampleApp),
  properties: [...ROOM_LIBRARY_PROPERTIES, ownerStable],
});
