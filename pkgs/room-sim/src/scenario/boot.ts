import type { InMemoryRoomStorage } from '@pkgs/room-adapter-memory';
import type {
  CatalogAction,
  CatalogProperty,
  Session,
  System,
} from '@pkgs/sim';
import { defineRuntime, virtualTimeRuntime } from '@pkgs/sim';
import { createRoomSimRuntime } from '../create-room-sim';
import type { RoomApp } from './app';
import type { RoomArgs } from './args';
import { invariants, staysInSync } from './observations';
import {
  domainAction,
  LIBRARY_ACTIONS,
  SCRIPTED_ACTIONS,
} from './room-actions';
import type { RoomSim } from './sim';

export const SIM_START_MS = 1_700_000_000_000;

/** Every room app system has the same surface and args shape. */
export type RoomSystemDef = System<RoomSim, RoomArgs>;

/** Default virtual host for room systems. */
export function roomVirtual() {
  return virtualTimeRuntime({ startTime: SIM_START_MS });
}

export const ROOM_VIRTUAL_RUNTIME = defineRuntime({
  default: true,
  name: 'virtual',
  create: roomVirtual,
});

/**
 * Inline virtual runtime pinned to `startTime`, for scenarios that assert
 * against a small absolute clock epoch. Pass into `system.run({ runtime })`.
 */
export function roomEpoch(startTime: number) {
  return defineRuntime({
    name: `virtual@${String(startTime)}`,
    create: () => virtualTimeRuntime({ startTime }),
  });
}

export type BootRoomOpts = {
  readonly topic?: string;
  readonly storage?: InMemoryRoomStorage;
};

/**
 * Domain boot for a room system `create`: one kit, `clientCount` clients, and
 * a session that settles through `kit.drain` rather than the bare scheduler.
 */
export async function bootRoomSim(
  session: Session,
  app: RoomApp,
  args: RoomArgs,
  opts?: BootRoomOpts
): Promise<RoomSim> {
  const kit = await createRoomSimRuntime({
    session,
    module: app.module,
    mildFaults: args.mildFaults,
    ...(opts?.topic !== undefined ? { topic: opts.topic } : {}),
    ...(opts?.storage !== undefined ? { storage: opts.storage } : {}),
    ...(app.authorize !== undefined ? { authorize: app.authorize } : {}),
  });
  for (let i = 0; i < args.clientCount; i += 1) {
    await kit.addClient({ id: `c${String(i)}` });
  }
  const mutable = session as { waitForIdle: () => Promise<void> };
  mutable.waitForIdle = () => kit.drain();
  return {
    session,
    app,
    kit,
    clients: kit.clients,
    server: kit.server,
  } satisfies RoomSim;
}

/** Shared explore pool + domain action for one room app. */
export function roomLibraryActions(app: RoomApp): CatalogAction<RoomSim>[] {
  return [domainAction(app), ...LIBRARY_ACTIONS, ...SCRIPTED_ACTIONS];
}

/** Standing properties registered on every room system. */
export const ROOM_LIBRARY_PROPERTIES: readonly CatalogProperty<RoomSim>[] = [
  invariants,
  staysInSync,
];

/** Default runtime + shared catalogs for a room `defineSystem`. */
export function roomSystemCatalog(app: RoomApp): {
  readonly runtimes: readonly [typeof ROOM_VIRTUAL_RUNTIME];
  readonly actions: CatalogAction<RoomSim>[];
  readonly properties: readonly CatalogProperty<RoomSim>[];
} {
  return {
    runtimes: [ROOM_VIRTUAL_RUNTIME],
    actions: roomLibraryActions(app),
    properties: ROOM_LIBRARY_PROPERTIES,
  };
}

export type { RoomSim };
