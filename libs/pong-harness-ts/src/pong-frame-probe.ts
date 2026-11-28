import { simulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-fixture';
import {
  browserTimers,
  connectSimulationRoomFixture,
  displayFrames,
  type RealtimeDeviceProfile,
  slowLiveStorage,
} from '@libs/game-session-harness-ts/simulation-room-presentation';
import { FixedStepSimulation } from '@libs/game-simulation-shared-ts/simulation-engine';
import {
  type SimulationSnapshotPayload,
  SimulationStateChanged,
} from '@libs/game-simulation-shared-ts/simulation-messages';
import {
  pongGameShared,
  pongPositionCodec,
} from '@libs/pong-shared-ts/pong-game';
import type { PongState } from '@libs/pong-shared-ts/pong-state';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import { createRoomHarnessRuntime } from '@pkgs/room-root-harness-ts/create-room-harness';
import {
  type FrameSample,
  frameEvidence,
  type PongFrameReport,
  summarizeFrames,
} from './pong-frame-report';

const simulation = pongGameShared.registration.simulation!;
const config = { tickRate: simulation.timing.tickRate };

/** Who plays, on what device. */
export type PongFrameProfile = RealtimeDeviceProfile & {
  /** `bot`: one person against a bot, run on their own device. `two-devices`: two people, run by the room. */
  readonly play: 'bot' | 'two-devices';
};

function rallyPosition(seed: string): string {
  const engine = new FixedStepSimulation(
    simulation.initialize(seed),
    simulation.step,
    { ...simulation.timing, seed }
  );
  for (let tick = 0; tick < simulation.timing.tickRate * 3.75; tick++)
    engine.advanceTicks(1);
  return simulation.codec.encode(engine.snapshot().state);
}

type Device = {
  readonly id: 'alice' | 'bob';
  readonly side: 'white' | 'black';
  shown: PongState | null;
  readonly received: { tick: number; at: number; state: PongState }[];
};

async function createFramePong(session: Session, profile: PongFrameProfile) {
  const id = session.ports.createId();
  const people: Device['id'][] =
    profile.play === 'bot' ? ['alice'] : ['alice', 'bob'];
  const kit = await createRoomHarnessRuntime({
    session,
    module: simulationRoomFixture(
      {
        game: pongGameShared,
        id,
        viewers: [],
        players: profile.play === 'bot' ? ['alice', null] : ['alice', 'bob'],
        position: rallyPosition(id),
      },
      session.ports.clock,
      session.ports.random
    ),
    topic: 'space:pong-frames',
  });
  (session as { waitForIdle: () => Promise<void> }).waitForIdle = kit.drain;
  const random = () => session.ports.random();
  const timers = browserTimers(
    session.ports.timers,
    random,
    profile.timerLateMs
  );
  const now = () => session.ports.clock.now();
  const display = displayFrames(session.ports.timers, now, profile.displayHz);
  session.onDispose(display.stop);
  const devices: Device[] = [];
  const connections = new Map<
    Device['id'],
    ReturnType<typeof connectSimulationRoomFixture>
  >();
  const errors: unknown[] = [];
  for (const person of people) {
    const client = await kit.addClient({ id: person });
    await kit.drain();
    kit.net(person).set(profile.network);
    const room = client.room()!;
    const device: Device = {
      id: person,
      side: person === 'alice' ? 'white' : 'black',
      shown: null,
      received: [],
    };
    devices.push(device);
    const slowStorage = slowLiveStorage(room, session, profile.storageMs);
    const connection = connectSimulationRoomFixture(pongGameShared, {
      owner: person,
      room: slowStorage,
      clock: session.ports.clock,
      timers,
      frames: display,
      createId: session.ports.createId,
      changed: (view) => {
        const state =
          view.position === null
            ? null
            : pongPositionCodec.decode(view.position);
        if (view.position !== null && state === null)
          errors.push(new Error('invalid presented court'));
        device.shown = view.paused || view.stale ? null : state;
      },
      failed: (error) => errors.push(error),
    });
    const receive = connection.replica.receive.bind(connection.replica);
    connection.replica.receive = (message, epoch) => {
      const accepted = receive(message, epoch);
      if (accepted && SimulationStateChanged.is(message)) {
        const payload: SimulationSnapshotPayload = message.payload;
        const state = pongPositionCodec.decode(payload.state);
        if (state !== null)
          device.received.push({ tick: payload.tick, at: now(), state });
      }
      return accepted;
    };
    connections.set(person, connection);
    session.onDispose(connection.dispose);
  }
  const samples = new Map<Device['id'], FrameSample[]>(
    people.map((person) => [person, []])
  );
  return {
    session,
    kit,
    profile,
    devices,
    connections,
    errors,
    samples,
    display,
    now,
  };
}

export type PongFrames = Awaited<ReturnType<typeof createFramePong>>;

/** The least time a person keeps a key down or up before changing it again. */
const REACTION_MS = 100;

/**
 * A person playing on each device: they hold the direction toward the ball
 * and let go near it, as a person keeping a rally alive does, changing what
 * they hold no faster than a person reacts.
 */
function steer(
  s: PongFrames,
  device: Device,
  held: Map<string, -1 | 0 | 1>,
  changedAt: Map<string, number>
) {
  const shown = device.shown;
  if (shown === null || shown.phase !== 'playing') return null;
  if (
    s.now() - (changedAt.get(device.id) ?? Number.NEGATIVE_INFINITY) <
    REACTION_MS
  )
    return null;
  const paddle = shown.paddles[device.side === 'white' ? 'left' : 'right'];
  const gap = shown.ball.y - paddle.y;
  const direction: -1 | 0 | 1 =
    Math.abs(gap) < 30 ? 0 : gap > 0 ? (1 as const) : (-1 as const);
  if (held.get(device.id) === direction) return null;
  held.set(device.id, direction);
  changedAt.set(device.id, s.now());
  s.connections
    .get(device.id)!
    .replica.control(device.side, { kind: 'direction', direction });
  // A press into the end of the court cannot move the paddle: it is no response to time.
  const reach = 800 / 2 - 72 - 1;
  const blocked =
    Math.abs(paddle.y - 400) >= reach && (paddle.y - 400) * direction > 0;
  return direction === 0 || blocked
    ? null
    : { direction, y: paddle.y, at: s.now() };
}

/** What the people at the devices are doing, and how long their paddles took to answer. */
type People = {
  readonly held: Map<string, -1 | 0 | 1>;
  readonly changedAt: Map<string, number>;
  readonly pressed: Map<string, { direction: -1 | 1; y: number; at: number }>;
  readonly responses: { atMs: number; value: number }[];
};

/** One device at one refresh: whether a press shows yet, what it shows, and what its person does next. */
function watchDevice(
  s: PongFrames,
  people: People,
  device: Device,
  at: number
) {
  const press = people.pressed.get(device.id);
  const shown = device.shown;
  const own = device.side === 'white' ? ('left' as const) : ('right' as const);
  if (
    press !== undefined &&
    shown !== null &&
    (shown.paddles[own].y - press.y) * press.direction >= 1
  ) {
    people.responses.push({ atMs: at, value: at - press.at });
    people.pressed.delete(device.id);
  }
  s.samples.get(device.id)!.push({
    at,
    state: shown,
    tick: displayedTick(device, shown),
    own,
    held: people.held.get(device.id) ?? 0,
  });
  const next = steer(s, device, people.held, people.changedAt);
  if (next !== null && !people.pressed.has(device.id))
    people.pressed.set(device.id, {
      direction: next.direction as -1 | 1,
      y: next.y,
      at: next.at,
    });
}

/** Play for the profile's duration and read every frame each display showed. */
export async function measurePongFrames(
  s: PongFrames
): Promise<PongFrameReport> {
  await s.kit.runFor(1000);
  const people: People = {
    held: new Map(),
    changedAt: new Map(),
    pressed: new Map(),
    responses: [],
  };
  s.display.onVsync((at) => {
    for (const device of s.devices) watchDevice(s, people, device, at);
  });
  await s.kit.runFor(s.profile.seconds * 1000);
  const device = s.devices[0]!;
  return summarizeFrames({
    evidence: frameEvidence({
      samples: s.samples.get(device.id)!,
      received: device.received,
      tickRate: config.tickRate,
      responses: people.responses,
    }),
    received: device.received,
    errors: s.errors.length,
  });
}

/**
 * The authority tick a shown court belongs to: where its ball lies between
 * two received courts of the same rally. Null while the ball rests or the
 * shown court matches none.
 */
function displayedTick(device: Device, shown: PongState | null) {
  if (shown === null || shown.phase !== 'playing') return null;
  const received = device.received;
  for (let index = received.length - 1; index > 0; index--) {
    const after = received[index]!;
    const before = received[index - 1]!;
    if (
      before.state.feedback.points !== shown.feedback.points ||
      after.state.feedback.points !== shown.feedback.points
    )
      continue;
    const dx = after.state.ball.x - before.state.ball.x;
    if (dx === 0) continue;
    const fraction = (shown.ball.x - before.state.ball.x) / dx;
    if (fraction >= -1e-6 && fraction <= 1 + 1e-6)
      return before.tick + fraction * (after.tick - before.tick);
    if (index < received.length - 8) break;
  }
  return null;
}

export const pongFrameSystem = defineSystem({
  name: 'pong-frames',
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: createFramePong,
  actions: [],
});
