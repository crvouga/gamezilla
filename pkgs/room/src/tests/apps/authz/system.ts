import { defineSystem } from '@pkgs/dst';
import {
  bootRoomSurface,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomArgs,
  type RoomSurface,
  registerRoomLibrary,
  roomVirtual,
  serverCrashed,
} from '../../../sim/scenario';
import { authzOwner } from '../../fixtures/authz-module';
import { authzApp } from './app';

/** Authz system: owner-gated domain ops. */
export const authzSystem = defineSystem<RoomSurface, RoomArgs>({
  name: 'room.authz',
  args: ROOM_ARGS,
  draw: ROOM_DRAW,
  create: (session, args) => bootRoomSurface(session, authzApp, args),
});
authzSystem.host({ default: true, name: 'virtual', create: roomVirtual });
registerRoomLibrary(authzSystem, authzApp);

/** Once claimed, ownership never moves — not across takeOver, crash, or restart. */
authzSystem.property<{ owner: string | null }>({
  name: 'ownerStable',
  setup: () => ({ owner: null }),
  check: async (s, ctx) => {
    if (serverCrashed(s)) return ctx;
    const owner = authzOwner(await s.kit.serverSnapshot());
    if (ctx.owner !== null && owner !== ctx.owner) {
      throw new Error(
        `owner moved from ${ctx.owner} to ${String(owner)} after claim`
      );
    }
    return { owner: owner ?? ctx.owner };
  },
});
