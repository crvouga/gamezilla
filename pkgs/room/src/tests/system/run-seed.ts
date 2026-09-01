import { openWorld } from '@pkgs/determinism';
import type { RoomApp, RoomSystemAction } from '../../sim/system';
import {
  defineRoomSystem,
  dispatchRoomSystemAction,
  roomWorld,
} from '../../sim/system';
import type { World } from '../../sim/world-api';
import { createFuzzState, pickRoomSystemAction } from './pick-library-action';

export type RunSeedResult =
  | { readonly ok: true; readonly seed: bigint; readonly steps: number }
  | {
      readonly ok: false;
      readonly seed: bigint;
      readonly steps: number;
      readonly error: string;
    };

export type RunSeedOptions = {
  readonly app: RoomApp;
  readonly seed: number | bigint | string;
  readonly clientCount?: number;
  readonly steps?: number;
  readonly mildFaults?: boolean;
};

function clientIdsFor(opts: RunSeedOptions): readonly string[] {
  const count = opts.clientCount ?? 2;
  return Array.from({ length: count }, (_, i) => `c${i}`);
}

type SeedHost = Awaited<ReturnType<typeof openWorld>>;

/**
 * Boot the same topology `defineRoomSystem` does via framework `openWorld`.
 */
async function openSeedWorld(
  opts: RunSeedOptions
): Promise<{ readonly host: SeedHost; readonly world: World }> {
  const system = defineRoomSystem(opts.app, { id: 'room.seed' });
  const host = await openWorld(system, {
    seed: opts.seed,
    knobs: {
      clientCount: opts.clientCount ?? 2,
      mildFaults: opts.mildFaults === true,
    },
  });
  return { host, world: roomWorld(host.state) };
}

/**
 * Run one seeded universe: N clients, random workload, heal + converge.
 * On failure returns seed for exact replay.
 */
export async function runRoomSeed(
  opts: RunSeedOptions
): Promise<RunSeedResult> {
  const steps = opts.steps ?? 40;
  const { host, world } = await openSeedWorld(opts);
  await using _host = host;
  const ids = clientIdsFor(opts);
  try {
    const workRng = world.rng.fork('workload');
    const fuzz = createFuzzState(ids);
    let done = 0;
    for (let i = 0; i < steps; i += 1) {
      const action: RoomSystemAction = pickRoomSystemAction(
        workRng,
        ids,
        opts.app.pickDomainOp,
        fuzz
      );
      await dispatchRoomSystemAction(world, opts.app, action);
      done += 1;
      if (!world.isServerCrashed()) {
        const inv = await world.checkInvariants();
        if (inv !== null) {
          return {
            ok: false,
            seed: world.seed,
            steps: done,
            error: `${inv.invariant}: ${inv.detail}`,
          };
        }
      }
      await world.runFor(20);
    }
    await world.assertConverged();
    return { ok: true, seed: world.seed, steps: done };
  } catch (err) {
    return {
      ok: false,
      seed: world.seed,
      steps,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Prefer ROOM_SIM_SEED, then SIM_SEED (legacy room scenarios). */
export function seedsFromEnv(): string[] {
  const room = process.env['ROOM_SIM_SEED'];
  if (room !== undefined && room.length > 0) return [room];
  const sim = process.env['SIM_SEED'];
  if (sim !== undefined && sim.length > 0) return [sim];
  return [];
}

/** Fingerprint of server + client domain hashes after a seeded run. */
export async function roomSeedFingerprint(
  opts: RunSeedOptions
): Promise<string> {
  const steps = opts.steps ?? 40;
  const { host, world } = await openSeedWorld(opts);
  await using _host = host;
  const ids = clientIdsFor(opts);
  const workRng = world.rng.fork('workload');
  const fuzz = createFuzzState(ids);
  for (let i = 0; i < steps; i += 1) {
    const action = pickRoomSystemAction(
      workRng,
      ids,
      opts.app.pickDomainOp,
      fuzz
    );
    await dispatchRoomSystemAction(world, opts.app, action);
    await world.runFor(20);
  }
  await world.assertConverged();
  const parts = [await world.serverHash()];
  for (const id of ids) {
    const c = world.clients.get(id);
    if (c !== undefined && !c.isCrashed()) {
      parts.push(c.hash());
    }
  }
  return parts.join(':');
}
