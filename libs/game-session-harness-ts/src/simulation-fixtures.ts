import type { GameRegistration } from '@libs/game-session-shared-ts/game-definition';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import { RecoverSimulation } from '@libs/game-session-shared-ts/simulation-recovery';
import { ensureActor } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import type { SimulationInput } from '@pkgs/turn-game-shared-ts/simulation';
import { showCustomGames } from './game-navigation';

/** Author-decided examples, including an unfinished state that reaches its result. */
export type SimulationHarnessFixtures = {
  readonly refusedInputs: readonly unknown[];
  readonly examples: readonly {
    readonly seed: string;
    readonly initialPosition: string;
    readonly inputs: readonly SimulationInput<unknown>[];
    readonly ticks: number;
    readonly expectedPosition: string;
  }[];
};

/** A game's declared opening, with the real session seed for seeded mechanics. */
export function initialHarnessPosition(
  game: GameRegistration,
  seed: string
): string {
  const simulation = game.registration.simulation;
  return simulation === undefined
    ? game.registration.rules.initial()
    : simulation.codec.encode(simulation.initialize(seed));
}

export function assertSimulationFixtures(
  simulation: RegisteredSimulation,
  fixtures: SimulationHarnessFixtures,
  fail: (problem: string) => never
): void {
  if (fixtures.refusedInputs.length === 0)
    fail('name at least one refused simulation input');
  for (const value of fixtures.refusedInputs)
    if (simulation.parseInput(value) !== null)
      fail('a refused simulation input is accepted');
  if (fixtures.examples.length === 0)
    fail('name independent simulation examples');
  const terminal = fixtures.examples.map((example) =>
    checkExample(simulation, example, fail)
  );
  if (!terminal.includes(true))
    fail('name an unfinished simulation example that reaches its result');
}

function checkExample(
  simulation: RegisteredSimulation,
  example: SimulationHarnessFixtures['examples'][number],
  fail: (problem: string) => never
): boolean {
  const initial = simulation.codec.decode(example.initialPosition);
  const expected = simulation.codec.decode(example.expectedPosition);
  if (initial === null || expected === null)
    return fail('a simulation example has an invalid position');
  if (!Number.isSafeInteger(example.ticks) || example.ticks < 1)
    return fail('a simulation example must advance positive whole ticks');
  const engine = new FixedStepSimulation(initial, simulation.step, {
    ...simulation.timing,
    seed: example.seed,
  });
  for (const input of example.inputs) {
    const value = simulation.parseInput(input.value);
    if (value === null || !engine.enqueue({ ...input, value }).accepted)
      fail('a simulation example queues an invalid input');
  }
  engine.advanceTicks(example.ticks);
  if (
    simulation.codec.encode(engine.snapshot().state) !==
    simulation.codec.encode(expected)
  )
    fail(
      'a simulation example disagrees with its independent expected position'
    );
  return (
    simulation.result(initial) === null && simulation.result(expected) !== null
  );
}

type Recovery = Parameters<typeof RecoverSimulation.is>[0];

/** A saved live game holding `arrange(position)`, or null when `arrange` passes it by. */
function rearranged(
  payload: Recovery,
  arrange: (position: string) => string | null
): Recovery | null {
  if (!RecoverSimulation.is(payload)) return null;
  const recovery = payload.payload;
  const position = arrange(recovery.checkpoint.position);
  if (position === null) return null;
  return RecoverSimulation({
    ...recovery,
    checkpoint: { ...recovery.checkpoint, position },
  });
}

/** The saved value a device keeps, possibly as JSON text. */
function parsed(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function rewriteDeviceRecord(
  raw: string,
  arrange: (position: string) => string | null
): string | null {
  const record = parsed(raw);
  if (record === null || typeof record !== 'object') return null;
  for (const [field, value] of Object.entries(record)) {
    const checkpoint = parsed(value) as {
      readonly payload?: Recovery;
    } | null;
    if (checkpoint?.payload === undefined) continue;
    const payload = rearranged(checkpoint.payload, arrange);
    if (payload === null) continue;
    const next = { ...checkpoint, payload };
    return JSON.stringify({
      ...record,
      [field]: typeof value === 'string' ? JSON.stringify(next) : next,
    });
  }
  return null;
}

/**
 * A recovery fixture for real-time games: the room hosting a shared game
 * restarts from its saved live game holding `arrange(position)` instead.
 * The game's authority recovers it through its own validation, so a
 * position the game's codec refuses fails there; every device then sees it
 * as it sees any recovered game. `arrange` returns null for a save that is
 * not the scenario's game.
 */
export async function restoreSharedSimulation(
  s: ProductHarness,
  arrange: (position: string) => string | null
): Promise<void> {
  await s.session.waitForIdle();
  const node = s.harness.roomNode;
  for (const topic of node.listTopics()) {
    const room = node.exportTopic(topic);
    const saved = room?.liveCheckpoint;
    if (room == null || saved == null) continue;
    const payload = rearranged(saved.payload as Recovery, arrange);
    if (payload === null) continue;
    await node.replaceTopic(topic, {
      entries: room.entries,
      dedup: room.dedup ?? {},
      liveCheckpoint: { atSeq: saved.atSeq, payload },
    });
    await s.session.waitForIdle();
    return;
  }
  throw new Error('No real-time game is saved in a room');
}

/**
 * The same fixture for a game running on one device (practice against
 * bots): the app is closed, the game it saved holds `arrange(position)`,
 * and the app reopens to it, recovering it through the same validation as
 * any reopened game.
 */
export async function restoreDeviceSimulation(
  s: ProductHarness,
  device: { readonly actor: string; readonly gameId: string },
  arrange: (position: string) => string | null
): Promise<void> {
  await s.session.waitForIdle();
  await s.runtime.restartActor(device.actor);
  const prefix = `${s.harness.clientNamespace(device.actor)}.`;
  const storage = globalThis.localStorage;
  let rewritten = false;
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === null || !key.startsWith(prefix) || !key.endsWith('-live'))
      continue;
    const next = rewriteDeviceRecord(storage.getItem(key) ?? '', arrange);
    if (next === null) continue;
    storage.setItem(key, next);
    rewritten = true;
  }
  if (!rewritten)
    throw new Error(`${device.actor}'s device saved no real-time game`);
  await ensureActor(s, device.actor);
  await showCustomGames(s, device.actor, device.gameId);
  await s.session.waitForIdle();
}
