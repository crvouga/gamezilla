import type { RoomDstAction } from '../../sim/dst/actions';
import type { RoomDstApp } from '../../sim/dst/app';
import { dispatchRoomDstAction } from '../../sim/dst/dispatch';
import { openWorld } from '../../sim/world';
import { createFuzzState, pickRoomDstAction } from './pick-library-action';

export type RunSeedResult =
  | { readonly ok: true; readonly seed: bigint; readonly steps: number }
  | {
      readonly ok: false;
      readonly seed: bigint;
      readonly steps: number;
      readonly error: string;
    };

export type RunSeedOptions = {
  readonly app: RoomDstApp;
  readonly seed: number | bigint | string;
  readonly clientCount?: number;
  readonly steps?: number;
  readonly mildFaults?: boolean;
};

/**
 * Run one seeded universe: N clients, random workload, heal + converge.
 * On failure returns seed for exact replay.
 */
export async function runRoomSeed(
  opts: RunSeedOptions
): Promise<RunSeedResult> {
  const clientCount = opts.clientCount ?? 2;
  const steps = opts.steps ?? 40;
  await using world = await openWorld({
    app: opts.app,
    seed: opts.seed,
    knobs: {
      clientCount,
      mildFaults: opts.mildFaults === true,
    },
  });
  const ids = [...world.clientIds];
  try {
    const workRng = world.rng.fork('workload');
    const fuzz = createFuzzState(ids);
    let done = 0;
    for (let i = 0; i < steps; i += 1) {
      const action: RoomDstAction = pickRoomDstAction(
        workRng,
        ids,
        opts.app.pickDomainOp,
        fuzz
      );
      await dispatchRoomDstAction(world, opts.app, action);
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
  const clientCount = opts.clientCount ?? 2;
  const steps = opts.steps ?? 40;
  await using world = await openWorld({
    app: opts.app,
    seed: opts.seed,
    knobs: {
      clientCount,
      mildFaults: opts.mildFaults === true,
    },
  });
  const ids = [...world.clientIds];
  const workRng = world.rng.fork('workload');
  const fuzz = createFuzzState(ids);
  for (let i = 0; i < steps; i += 1) {
    const action = pickRoomDstAction(workRng, ids, opts.app.pickDomainOp, fuzz);
    await dispatchRoomDstAction(world, opts.app, action);
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
