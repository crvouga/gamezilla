import { defineProperty, defineSystem } from '@pkgs/harness';
import { readOwner } from '@pkgs/room/harness';
import {
  bootRoomHarness,
  ROOM_ARGS,
  ROOM_DRAW,
  ROOM_LIBRARY_PROPERTIES,
  type RoomArgs,
  type RoomHarness,
  roomSystemCatalog,
  serverCrashed,
} from '../scenario';
import { exampleApp } from './app';

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
