import { expect, test } from 'bun:test';
import { withSimulationBots } from '@libs/game-session-shared-ts/simulation-bots';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import {
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import {
  lightCyclesDuelShared,
  lightCyclesQuadShared,
  lightCyclesTrioShared,
} from '@libs/light-cycles-shared-ts/light-cycles-game';
import {
  type LightCyclesState,
  lightCyclesRoundStart,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Message } from '@pkgs/message-shared-ts/message';
import {
  createTurnGames,
  gameSides,
} from '@pkgs/turn-game-shared-ts/game-rules';

const MODES = [
  lightCyclesDuelShared,
  lightCyclesTrioShared,
  lightCyclesQuadShared,
];

test('three modes of one family each recognize only their own positions', () => {
  const games = createTurnGames(MODES.map((mode) => mode.registration));
  for (const mode of MODES) {
    const rules = mode.registration.rules;
    expect(rules.family).toBe('light-cycles');
    expect(games.forPosition(rules.initial()).id).toBe(mode.id);
    expect(mode.registration.simulation?.input).toEqual({
      mode: 'commands',
      maxPendingPerPlayer: 4,
      maxAgeTicks: 30,
    });
    expect(mode.registration.simulation?.disconnection?.policy).toBe(
      'continue'
    );
  }
  expect(
    MODES.map((mode) => gameSides(mode.registration.rules).length)
  ).toEqual([2, 3, 4]);
});

test('the target score is chosen from 1 to 9 and survives a rematch', () => {
  const rules = lightCyclesTrioShared.registration.rules;
  const simulation = lightCyclesTrioShared.registration.simulation!;
  for (const refused of ['0', '10', 'x', '3.5'])
    expect(rules.configuration!.apply(rules.initial(), refused)).toBeNull();
  const nine = rules.configuration!.apply(rules.initial(), '9')!;
  expect((simulation.codec.decode(nine) as LightCyclesState).targetScore).toBe(
    9
  );
  const restarted = rules.configuration!.restart(nine);
  expect(
    (simulation.codec.decode(restarted) as LightCyclesState).targetScore
  ).toBe(9);
  expect(rules.recognizes(restarted)).toBe(true);
});

test('four bots finish a seeded Quad through the real engine with one result', () => {
  const simulation = lightCyclesQuadShared.registration.simulation!;
  const step = withSimulationBots(
    simulation.step,
    (['white', 'black', 'red', 'blue'] as const).map((side) => ({
      playerId: side,
      input: (state, context) =>
        simulation.bots!.input(state, side, 'hard', context),
    })),
    simulation.parseInput
  );
  const engine = new FixedStepSimulation(simulation.initialize('quad'), step, {
    ...simulation.timing,
    seed: 'quad',
  });
  let ticks = 0;
  while (
    simulation.result(engine.snapshot().state) === null &&
    ticks < 90_000
  ) {
    engine.advanceTicks(simulation.timing.maxCatchUpTicks);
    ticks += simulation.timing.maxCatchUpTicks;
  }
  const finished = engine.snapshot().state as LightCyclesState;
  expect(simulation.result(finished)).not.toBeNull();
  const encoded = simulation.codec.encode(finished);
  expect(simulation.codec.decode(encoded)).toEqual(finished);
});

test('a replica sends each turn once with its round and drops outstanding turns of an ended round', () => {
  const simulation = lightCyclesDuelShared.registration.simulation!;
  const time = createHarnessClock();
  const sent: Message[] = [];
  const replica = new SimulationReplica({
    simulation,
    clock: time.clock,
    send: (message) => {
      sent.push(message);
      return String(sent.length);
    },
    measure: () => undefined,
  });
  const state = simulation.initialize('duel') as LightCyclesState;
  const snapshot = (round: number, revision: number) =>
    SimulationStateChanged({
      version: 1,
      epoch: 'duel:1:0',
      revision,
      tick: revision * 3,
      paused: false,
      state: simulation.codec.encode({
        ...state,
        ...lightCyclesRoundStart(state.seats, state, round),
        round,
        roundWinner: round === 1 ? null : 'draw',
      }),
      acknowledged: {},
    });
  expect(replica.receive(snapshot(1, 1), 'duel:1:0')).toBe(true);
  expect(replica.control('white', { round: 1, heading: 'up' })).toBe(true);
  expect(replica.control('white', { round: 1, heading: 'left' })).toBe(true);
  replica.pump();
  const turns = sent.filter((message) => SubmitSimulationInput.is(message));
  expect(turns.map((message) => message.payload)).toMatchObject([
    { playerId: 'white', sequence: 1, value: { round: 1, heading: 'up' } },
    { playerId: 'white', sequence: 2, value: { round: 1, heading: 'left' } },
  ]);
  expect(replica.receive(snapshot(2, 2), 'duel:1:0')).toBe(true);
  replica.pump();
  expect(sent).toHaveLength(2);
});
