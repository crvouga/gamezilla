import { defineProperty, defineSystem } from '@pkgs/harness';
import { authzOwner } from '../authz-module';
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
import { authzApp } from './app';

/** Once claimed, ownership never moves — not across takeOver, crash, or restart. */
const ownerStable = defineProperty<RoomHarness, { owner: string | null }>({
  name: 'ownerStable',
  setup: () => ({ owner: null }),
  check: async (s, model) => {
    if (serverCrashed(s)) return model;
    const owner = authzOwner(await s.kit.serverSnapshot());
    if (model.owner !== null && owner !== model.owner) {
      throw new Error(
        `owner moved from ${model.owner} to ${String(owner)} after claim`
      );
    }
    return { owner: owner ?? model.owner };
  },
});

/** Authz system: owner-gated domain ops. */
export const authzSystem = defineSystem<RoomHarness, RoomArgs>({
  name: 'room.authz',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomHarness(session, authzApp, args),
  ...roomSystemCatalog(authzApp),
  properties: [...ROOM_LIBRARY_PROPERTIES, ownerStable],
});
