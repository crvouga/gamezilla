import type { Action, CatalogAction, Session, System } from '@pkgs/sim';
import { virtualTimeRuntime } from '@pkgs/sim';
import type { InMemoryRoomStorage } from '../../server/adapters/memory';
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

/**
 * Register (once) a virtual host pinned to `startTime` and return its name,
 * for scenarios that assert against a small absolute clock epoch.
 */
export function roomEpoch(system: RoomSystemDef, startTime: number): string {
  const name = `virtual@${String(startTime)}`;
  if (!system.runtimes.includes(name)) {
    system.runtime({ name, create: () => virtualTimeRuntime({ startTime }) });
  }
  return name;
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

/** Existential registration — the shared catalogs hold mixed action arities. */
function registerActions(
  system: RoomSystemDef,
  actions: readonly CatalogAction<RoomSim>[]
): void {
  for (const action of actions) {
    system.action(action as unknown as Action<RoomSim>);
  }
}

/** Register the shared room action pool + standing properties on `system`. */
export function registerRoomLibrary(system: RoomSystemDef, app: RoomApp): void {
  system.action(domainAction(app));
  registerActions(system, LIBRARY_ACTIONS);
  registerActions(system, SCRIPTED_ACTIONS);
  system.property(invariants);
  system.property(staysInSync);
}

export type { RoomSim };
