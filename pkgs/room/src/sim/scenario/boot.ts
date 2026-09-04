import type { Action, CatalogAction, Session, System } from '@pkgs/dst';
import { virtualHost } from '@pkgs/dst';
import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import { createRoomKit } from '../kit';
import type { RoomApp } from './app';
import type { RoomArgs } from './args';
import { converges, invariants } from './observations';
import {
  domainAction,
  LIBRARY_ACTIONS,
  SCRIPTED_ACTIONS,
} from './room-actions';
import type { RoomSurface } from './surface';

export const SIM_START_MS = 1_700_000_000_000;

/** Every room app system has the same surface and args shape. */
export type RoomSystemDef = System<RoomSurface, RoomArgs>;

/** Default virtual host for room systems. */
export function roomVirtual() {
  return virtualHost({ startTime: SIM_START_MS });
}

/**
 * Register (once) a virtual host pinned to `startTime` and return its name,
 * for scenarios that assert against a small absolute clock epoch.
 */
export function roomEpoch(system: RoomSystemDef, startTime: number): string {
  const name = `virtual@${String(startTime)}`;
  if (!system.hosts.includes(name)) {
    system.host({ name, create: () => virtualHost({ startTime }) });
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
export async function bootRoomSurface(
  session: Session,
  app: RoomApp,
  args: RoomArgs,
  opts?: BootRoomOpts
): Promise<RoomSurface> {
  const kit = await createRoomKit({
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
  const mutable = session as { settle: () => Promise<void> };
  mutable.settle = () => kit.drain();
  return {
    session,
    app,
    kit,
    clients: kit.clients,
    server: kit.server,
  } satisfies RoomSurface;
}

/** Existential registration — the shared catalogs hold mixed action arities. */
function registerActions(
  system: RoomSystemDef,
  actions: readonly CatalogAction<RoomSurface>[]
): void {
  for (const action of actions) {
    system.action(action as unknown as Action<RoomSurface>);
  }
}

/** Register the shared room action pool + standing properties on `system`. */
export function registerRoomLibrary(system: RoomSystemDef, app: RoomApp): void {
  system.action(domainAction(app));
  registerActions(system, LIBRARY_ACTIONS);
  registerActions(system, SCRIPTED_ACTIONS);
  system.property(invariants);
  system.property(converges);
}

export type { RoomSurface };
