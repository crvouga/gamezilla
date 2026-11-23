import {
  browserTimers,
  displayFrames,
  type Percentiles,
  percentiles,
  type RealtimeDeviceProfile,
  slowLiveStorage,
} from '@libs/game-session-harness-ts/realtime-device';
import { simulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-fixture';
import { connectSimulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-presentation';
import { lightCyclesDuelShared } from '@libs/light-cycles-shared-ts/light-cycles-game';
import {
  lightCyclesMode,
  lightCyclesModeConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import { createRoomHarnessRuntime } from '@pkgs/room-root-harness-ts/create-room-harness';

const game = lightCyclesDuelShared;
const simulation = game.registration.simulation!;

/** Who rides, on what device. */
export type LightCyclesFrameProfile = RealtimeDeviceProfile & {
  /** `bot`: one person against a bot, run on their own device. `two-devices`: two people, run by the room. */
  readonly play: 'bot' | 'two-devices';
};

/** How evenly one display showed the riders move, as a person watching would judge it. */
export type LightCyclesFrameReport = {
  /** Cell steps seen while riding. */
  readonly steps: number;
  /** The time a rider takes to cross one cell. */
  readonly cellMs: number;
  /** Share of steps shown a whole display frame or more off the rider's even pace. */
  readonly unevenRatio: number;
  /** Share of frames where a rider was shown crossing more than one cell at once. */
  readonly leapRatio: number;
  /** Milliseconds between one shown step of a rider and its next. */
  readonly stepIntervalMs: Percentiles;
  readonly errors: number;
  /** For each shown step, when, and its milliseconds off the rider's even pace. */
  readonly evidence: readonly { readonly atMs: number; readonly value: number }[];
};

type Rider = LightCyclesState['riders'][number];

async function createFrameRide(
  session: Session,
  profile: LightCyclesFrameProfile
) {
  const id = session.ports.createId();
  const people = profile.play === 'bot' ? ['alice'] : ['alice', 'bob'];
  const kit = await createRoomHarnessRuntime({
    session,
    module: simulationRoomFixture(
      {
        game,
        id,
        viewers: [],
        players: profile.play === 'bot' ? ['alice', null] : ['alice', 'bob'],
      },
      session.ports.clock,
      session.ports.random
    ),
    topic: 'space:light-cycles-frames',
  });
  (session as { waitForIdle: () => Promise<void> }).waitForIdle = kit.drain;
  const now = () => session.ports.clock.now();
  const timers = browserTimers(
    session.ports.timers,
    () => session.ports.random(),
    profile.timerLateMs
  );
  const display = displayFrames(session.ports.timers, now, profile.displayHz);
  session.onDispose(display.stop);
  const devices: {
    readonly id: string;
    readonly side: 'white' | 'black';
    shown: LightCyclesState | null;
    readonly connection: ReturnType<typeof connectSimulationRoomFixture>;
  }[] = [];
  const errors: unknown[] = [];
  for (const person of people) {
    const client = await kit.addClient({ id: person });
    await kit.drain();
    kit.net(person).set(profile.network);
    const device = {
      id: person,
      side: person === 'alice' ? ('white' as const) : ('black' as const),
      shown: null as LightCyclesState | null,
      connection: null as unknown as ReturnType<
        typeof connectSimulationRoomFixture
      >,
    };
    device.connection = connectSimulationRoomFixture(game, {
      owner: person,
      room: slowLiveStorage(client.room()!, session, profile.storageMs),
      clock: session.ports.clock,
      timers,
      frames: display,
      createId: session.ports.createId,
      changed: (view) => {
        const state =
          view.position === null
            ? null
            : (simulation.codec.decode(view.position) as LightCyclesState | null);
        if (view.position !== null && state === null)
          errors.push(new Error('invalid presented arena'));
        device.shown = view.paused || view.stale ? null : state;
      },
      failed: (error) => errors.push(error),
    });
    session.onDispose(device.connection.dispose);
    devices.push(device);
  }
  return { session, kit, profile, devices, display, errors, now };
}

export type LightCyclesFrames = Awaited<ReturnType<typeof createFrameRide>>;

/** Each person turns as a hard bot would, judging the arena they see, at most every cell. */
function ride(s: LightCyclesFrames, device: LightCyclesFrames['devices'][number]) {
  const shown = device.shown;
  if (shown === null || shown.phase !== 'running') return;
  const input = simulation.bots!.input(shown, device.side, 'hard', {
    tick: 0,
    deltaMs: 1000 / simulation.timing.tickRate,
    elapsedMs: 0,
    random: () => s.session.ports.random(),
  }) as { readonly heading: string };
  const own = shown.riders.find((rider) => rider.seat === device.side);
  if (own !== undefined && own.alive && input.heading !== own.heading)
    device.connection.replica.control(device.side, input);
}

/** Ride for the profile's duration and judge how evenly the first device showed the riders move. */
export async function measureLightCyclesFrames(
  s: LightCyclesFrames
): Promise<LightCyclesFrameReport> {
  await s.kit.runFor(1000);
  const cellMs =
    lightCyclesModeConfig(lightCyclesMode(2)).movementTicks *
    (1000 / simulation.timing.tickRate);
  const last = new Map<string, { at: number; x: number; y: number; round: number }>();
  const intervals: number[] = [];
  const evidence: { atMs: number; value: number }[] = [];
  let frames = 0;
  let leaps = 0;
  let nextTurnAt = 0;
  s.display.onVsync((at) => {
    const shown = s.devices[0]!.shown;
    if (shown !== null && shown.phase === 'running') {
      frames++;
      for (const rider of shown.riders as readonly Rider[]) {
        if (!rider.alive) continue;
        const previous = last.get(rider.seat);
        if (
          previous === undefined ||
          previous.round !== shown.round
        ) {
          last.set(rider.seat, { at, x: rider.x, y: rider.y, round: shown.round });
          continue;
        }
        const cells = Math.abs(rider.x - previous.x) + Math.abs(rider.y - previous.y);
        if (cells === 0) continue;
        if (cells > 1) leaps++;
        const interval = (at - previous.at) / cells;
        intervals.push(interval);
        evidence.push({ atMs: at, value: Math.abs(interval - cellMs) });
        last.set(rider.seat, { at, x: rider.x, y: rider.y, round: shown.round });
      }
    } else last.clear();
    if (at >= nextTurnAt) {
      nextTurnAt = at + cellMs;
      for (const device of s.devices) ride(s, device);
    }
  });
  await s.kit.runFor(s.profile.seconds * 1000);
  const frame = 1000 / s.profile.displayHz;
  return {
    steps: intervals.length,
    cellMs,
    unevenRatio:
      intervals.length === 0
        ? 0
        : intervals.filter((interval) => Math.abs(interval - cellMs) >= frame - 0.01)
            .length / intervals.length,
    leapRatio: frames === 0 ? 0 : leaps / frames,
    stepIntervalMs: percentiles(intervals),
    errors: s.errors.length,
    evidence,
  };
}

export const lightCyclesFrameSystem = defineSystem({
  name: 'light-cycles-frames',
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: createFrameRide,
  actions: [],
});
