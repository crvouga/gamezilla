import { expect, test } from 'bun:test';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { withSimulationBots } from '@libs/game-session-shared-ts/simulation-bots';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import {
  SimulationFailure,
  type SimulationReproduction,
} from '@libs/game-session-shared-ts/simulation-failure';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import type {
  BotDifficulty,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';

const original = continuousRaceGame.registration.simulation!;
const definition = defineGame({
  rules: continuousRaceGame.registration.rules,
  simulation: {
    ...original,
    bots: {
      input: (state, side, difficulty, context) =>
        Number(original.bots!.input(state, side, difficulty, context)) +
        (difficulty === 'medium' ? 10 : 20),
    },
    step: (state, inputs, context) => {
      if (
        context.tick === 2 &&
        inputs.some((input) => input.playerId === 'black')
      )
        throw new Error(
          `literal-bot-failure:${JSON.stringify(state)}:${inputs[0]?.value}:${context.random()}`
        );
      return original.step(state, inputs, context);
    },
  },
  capabilities: {
    'custom-games': {
      bots: { difficulties: ['easy', 'medium', 'hard'] },
      localPlayers: true,
    },
  },
});

test('a bot failure retains the game and bot recipe needed to replay the same second tick', async () => {
  // regression: simulation-failure-reproduction-loses-bot-context
  const rig = await liveSessionRoom(true, definition);
  const room = await rig.connect('alice');
  rig.transports.get('alice')!.closeFromServer();
  const errors: unknown[] = [];
  const rules = createTurnGames([definition.registration]);
  const local = new LocalSimulationSession({
    ...rig,
    room,
    owner: 'alice',
    rules,
    createId: () => 'replay-input',
    onError: (error) => errors.push(error),
  });
  try {
    await local.flush();
    rig.clock.advance(17);
    await local.flush();
    rig.clock.advance(17);
    await local.flush();
    const failure = errors.find((error) => error instanceof SimulationFailure);
    if (!(failure instanceof SimulationFailure))
      throw new Error('No bot failure captured');
    expect(failure.reproduction).toMatchObject({
      before: { tick: 1 },
      inputs: [],
      session: { bots: [{ side: 'black', difficulty: 'medium' }] },
    });
    const saved = JSON.parse(
      String(failure.diagnostic['app.error.reproduction'])
    ) as SimulationReproduction<unknown, unknown> & {
      session: {
        position: string;
        bots: readonly { side: GameSide; difficulty: BotDifficulty }[];
      };
    };
    const simulation = rules.simulation(
      rules.forPosition(saved.session.position).id
    )!;
    const step = withSimulationBots(
      simulation.step,
      saved.session.bots.map((bot) => ({
        playerId: bot.side,
        input: (state, context) =>
          simulation.bots!.input(state, bot.side, bot.difficulty, context),
      })),
      simulation.parseInput
    );
    const replay = new FixedStepSimulation(
      saved.before.state,
      step,
      saved.options
    );
    replay.restore(saved.before);
    for (const input of saved.inputs) replay.enqueue(input);
    expect(() => replay.advanceTicks(1)).toThrow(
      (failure.cause as Error).message
    );
  } finally {
    local.dispose();
    rig.dispose();
  }
});
