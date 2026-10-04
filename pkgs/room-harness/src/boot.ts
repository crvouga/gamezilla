import { defineRuntime } from '@pkgs/harness-shared/define-runtime';
import type { System } from '@pkgs/harness-shared/define-system';
import type {
  CatalogAction,
  CatalogProperty,
} from '@pkgs/harness-shared/effect';
import type { Session } from '@pkgs/harness-shared/runtime-types';
import { virtualTimeRuntime } from '@pkgs/harness-shared/virtual-time-runtime';
import type { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared/room-storage';
import type { RoomArgs } from './args';
import { createRoomHarnessRuntime } from './create-room-harness';
import type { RoomHarness } from './harness';
import { invariants, staysInSync } from './observations';
import {
  domainAction,
  LIBRARY_ACTIONS,
  SCRIPTED_ACTIONS,
} from './room-actions';
import type { RoomApp } from './scenario-app';

export const HARNESS_START_MS = 1_700_000_000_000;

/** Every room app system has the same surface and args shape. */
export type RoomSystemDef = System<RoomHarness, RoomArgs>;

/** Default virtual host for room systems. */
export function roomVirtual() {
  return virtualTimeRuntime({ startTime: HARNESS_START_MS });
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
export async function bootRoomHarness(
  session: Session,
  app: RoomApp,
  args: RoomArgs,
  opts?: BootRoomOpts
): Promise<RoomHarness> {
  const kit = await createRoomHarnessRuntime({
    session,
    module: app.module,
    mildFaults: args.mildFaults,
    ...(opts?.topic !== undefined ? { topic: opts.topic } : {}),
    ...(opts?.storage !== undefined ? { storage: opts.storage } : {}),
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
  } satisfies RoomHarness;
}

/** Shared explore pool + domain action for one room app. */
export function roomLibraryActions(app: RoomApp): CatalogAction<RoomHarness>[] {
  return [domainAction(app), ...LIBRARY_ACTIONS, ...SCRIPTED_ACTIONS];
}

/** Standing properties registered on every room system. */
export const ROOM_LIBRARY_PROPERTIES: readonly CatalogProperty<RoomHarness>[] =
  [invariants, staysInSync];

/** Default runtime + shared catalogs for a room `defineSystem`. */
export function roomSystemCatalog(app: RoomApp): {
  readonly runtimes: readonly [typeof ROOM_VIRTUAL_RUNTIME];
  readonly actions: CatalogAction<RoomHarness>[];
  readonly properties: readonly CatalogProperty<RoomHarness>[];
} {
  return {
    runtimes: [ROOM_VIRTUAL_RUNTIME],
    actions: roomLibraryActions(app),
    properties: ROOM_LIBRARY_PROPERTIES,
  };
}
