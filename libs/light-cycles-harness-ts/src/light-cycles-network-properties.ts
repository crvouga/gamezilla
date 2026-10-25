import { defineProperty } from '@pkgs/harness-root-shared-ts/define-property';
import {
  type ArenaSample,
  arenaViolations,
  transitionViolations,
} from './light-cycles-arena-invariants';
import {
  FORGED_SEQUENCE_BASE,
  type LightCyclesAbsence,
  type LightCyclesWorld,
} from './light-cycles-network-world';
import {
  decodeArena,
  LIGHT_CYCLES_RIDERS,
  LIGHT_CYCLES_TIMING,
} from './light-cycles-quad';
import type { Emission } from './light-cycles-wire-tap';

const GRACE_TICKS = 90;
const ticksIn = (ms: number) =>
  Math.floor((ms * LIGHT_CYCLES_TIMING.tickRate) / 1000);

function fail(problems: readonly string[]): void {
  if (problems.length > 0) throw new Error(problems.slice(0, 5).join('\n'));
}

const samples = new WeakMap<Emission, ArenaSample>();

export function sampleOf(emission: Emission): ArenaSample {
  const known = samples.get(emission);
  if (known !== undefined) return known;
  const state = decodeArena(emission.state);
  if (state === null)
    throw new Error(`revision ${emission.revision} is not a Quad arena`);
  const sample = {
    revision: emission.revision,
    tick: emission.tick,
    state,
    encoded: emission.state,
    acknowledged: emission.acknowledged,
  };
  samples.set(emission, sample);
  return sample;
}

function forgedAcknowledged(emission: Emission): string[] {
  return Object.entries(emission.acknowledged)
    .filter(([, sequence]) => sequence >= FORGED_SEQUENCE_BASE)
    .map(
      ([seat, sequence]) =>
        `revision ${emission.revision}: ${seat} acknowledged forged command ${sequence}`
    );
}

type ArenaModel = { seen: number; readonly last: Map<string, ArenaSample> };

/**
 * (b, c) Every publication: a valid arena, a lawful step from the game's
 * previous publication, nothing paused, and no forged command acknowledged.
 */
export const authoritativeArena = defineProperty({
  name: 'authoritative-arena',
  setup: (): ArenaModel => ({ seen: 0, last: new Map() }),
  check: (world: LightCyclesWorld, model: ArenaModel) => {
    const problems: string[] = [];
    for (const emission of world.tap.emissions.slice(model.seen)) {
      const sample = sampleOf(emission);
      if (emission.paused)
        problems.push(`revision ${emission.revision} paused the arena`);
      problems.push(
        ...forgedAcknowledged(emission),
        ...arenaViolations(sample)
      );
      const previous = model.last.get(emission.epoch);
      // A publication stored after a newer one is never applied by a replica.
      if (previous !== undefined && sample.revision < previous.revision)
        continue;
      if (previous !== undefined)
        problems.push(...transitionViolations(previous, sample));
      model.last.set(emission.epoch, sample);
    }
    model.seen = world.tap.emissions.length;
    fail(problems);
    return model;
  },
});

function stalledMs(world: LightCyclesWorld, from: number, to: number) {
  return world.stalls.reduce(
    (total, stall) =>
      total +
      Math.max(0, Math.min(to, stall.toMs) - Math.max(from, stall.fromMs)),
    0
  );
}

/** The latest committed tick when the absence began, bounded from above. */
function absenceTickBound(absence: LightCyclesAbsence): number {
  return (
    absence.tickBefore + ticksIn(absence.leftAtMs - absence.tickBeforeAtMs) + 2
  );
}

function absenceViolations(
  world: LightCyclesWorld,
  absence: LightCyclesAbsence
): string[] {
  const problems: string[] = [];
  const end = absence.returnedAtMs ?? world.session.ports.clock.now();
  const retireBy = absenceTickBound(absence) + GRACE_TICKS;
  let newest = absence.tickBefore;
  for (const emission of world.tap.emissions) {
    if (emission.atMs < absence.leftAtMs || emission.atMs >= end) continue;
    newest = Math.max(newest, emission.tick);
    const state = sampleOf(emission).state;
    const rider = state.riders.find((item) => item.seat === absence.seat)!;
    const playing = state.phase === 'countdown' || state.phase === 'running';
    if (emission.tick >= retireBy && playing && rider.alive)
      problems.push(
        `${absence.seat} still rides at tick ${emission.tick} after its grace (by ${retireBy})`
      );
  }
  const riding =
    end - absence.leftAtMs - stalledMs(world, absence.leftAtMs, end);
  const latest = world.tap.latest();
  // A finished game stops its tick loop; only an unfinished arena must keep going.
  const over = latest !== null && sampleOf(latest).state.phase === 'completed';
  if (
    !over &&
    riding >= 300 &&
    newest < absence.tickBefore + ticksIn(riding) - 8
  )
    problems.push(
      `the arena stalled while ${absence.seat} was away (${newest - absence.tickBefore} ticks in ${riding} ms)`
    );
  return problems;
}

/** A retirement crash appears only for a seat whose person was away its whole grace. */
function retirementViolations(world: LightCyclesWorld): string[] {
  const problems: string[] = [];
  const reported = new Set<string>();
  for (const emission of world.tap.emissions) {
    const state = sampleOf(emission).state;
    for (const crash of state.crashes) {
      const key = `${emission.epoch}:${state.round}:${crash.seat}`;
      if (crash.cause !== 'retired' || reported.has(key)) continue;
      reported.add(key);
      const excused = world.absences.some(
        (absence) =>
          absence.seat === crash.seat &&
          absence.leftAtMs <= emission.atMs &&
          emission.tick >= absence.tickBefore + 1 + GRACE_TICKS
      );
      if (!excused)
        problems.push(
          `${crash.seat} was retired at tick ${emission.tick} without being away for its grace`
        );
    }
  }
  return problems;
}

/** One live connection per rider's device: a replaced connection never steers. */
function controllerViolations(world: LightCyclesWorld): string[] {
  return Object.values(LIGHT_CYCLES_RIDERS).flatMap((person) => {
    const live = world.kit.server.connectionIdsForActor(person, person);
    return live.length > 1
      ? [`${person} has ${live.length} live connections to the arena`]
      : [];
  });
}

/**
 * (d) The arena keeps going while a rider's person is away, the rider is
 * retired after the grace period, only then, and a returning or replaced
 * connection leaves exactly one controller.
 */
export const absentRiders = defineProperty({
  name: 'absent-riders',
  check: (world: LightCyclesWorld) => {
    fail([
      ...world.absences.flatMap((absence) => absenceViolations(world, absence)),
      ...retirementViolations(world),
      ...controllerViolations(world),
    ]);
  },
});

/** Devices never fail, never present an invalid arena and never rewind. */
export const devicesStayValid = defineProperty({
  name: 'devices-stay-valid',
  check: (world: LightCyclesWorld) => fail(world.errors),
});
