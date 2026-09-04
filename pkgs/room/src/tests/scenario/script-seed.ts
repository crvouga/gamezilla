import type { Script } from '@pkgs/dst';
import { defineSystem } from '@pkgs/dst';
import { createSeededRng, type SeededRng } from '@pkgs/uuid';
import type {
  RoomApp,
  RoomArgs,
  RoomSurface,
  RoomSystemAction,
} from '../../sim/scenario';
import {
  applyTaggedRoomAction,
  bootRoomSurface,
  clientHash,
  invariantViolations,
  ROOM_ARGS,
  ROOM_DRAW,
  roomVirtual,
  seed as seedOf,
  serverCrashed,
  serverHash,
} from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
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

async function startSeedRun(
  opts: RunSeedOptions
): Promise<Script<RoomSurface> & AsyncDisposable> {
  const system = defineSystem<RoomSurface, RoomArgs>({
    name: 'room.seed',
    args: ROOM_ARGS,
    draw: ROOM_DRAW,
    create: (session, args) => bootRoomSurface(session, opts.app, args),
  });
  system.host({ default: true, name: 'virtual', create: roomVirtual });
  return system.script({
    seed: opts.seed,
    args: {
      clientCount: opts.clientCount ?? 2,
      mildFaults: opts.mildFaults === true,
    },
  });
}

/** Deterministic workload stream, derived from the booted kit's own seed. */
async function workloadRng(s: Script<RoomSurface>): Promise<SeededRng> {
  return createSeededRng(await s.observe(seedOf)).fork('workload');
}

async function stepWorkload(
  s: Script<RoomSurface>,
  opts: RunSeedOptions,
  rng: SeededRng,
  fuzz: ReturnType<typeof createFuzzState>
): Promise<void> {
  const action: RoomSystemAction = pickRoomSystemAction(
    rng,
    clientIdsFor(opts),
    opts.app.pickDomainOp,
    fuzz
  );
  await applyTaggedRoomAction(s, action);
}

async function firstViolation(s: Script<RoomSurface>): Promise<string | null> {
  if (await s.observe(serverCrashed)) return null;
  const msgs = await s.observe(invariantViolations);
  return msgs.length > 0 ? (msgs[0] as string) : null;
}

/**
 * Run one seeded universe: N clients, random workload, heal + converge.
 * On failure returns seed for exact replay.
 */
export async function runRoomSeed(
  opts: RunSeedOptions
): Promise<RunSeedResult> {
  const steps = opts.steps ?? 40;
  await using s = await startSeedRun(opts);
  const runSeedValue = BigInt(await s.observe(seedOf));
  const rng = await workloadRng(s);
  const fuzz = createFuzzState(clientIdsFor(opts));
  let done = 0;
  try {
    for (let i = 0; i < steps; i += 1) {
      await stepWorkload(s, opts, rng, fuzz);
      done += 1;
      const violation = await firstViolation(s);
      if (violation !== null) {
        return { ok: false, seed: runSeedValue, steps: done, error: violation };
      }
      await s.elapse(20);
    }
    await expectConverged(s);
    return { ok: true, seed: runSeedValue, steps: done };
  } catch (err) {
    return {
      ok: false,
      seed: runSeedValue,
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
  await using s = await startSeedRun(opts);
  const rng = await workloadRng(s);
  const ids = clientIdsFor(opts);
  const fuzz = createFuzzState(ids);
  for (let i = 0; i < steps; i += 1) {
    await stepWorkload(s, opts, rng, fuzz);
    await s.elapse(20);
  }
  await expectConverged(s);
  const hashes = (await s.observe(clientHash)) as Record<string, string>;
  const parts = [await s.observe(serverHash)];
  for (const id of ids) {
    const h = hashes[id];
    if (h !== undefined) parts.push(h);
  }
  return parts.join(':');
}
