import { gameSessionLegalMoves } from '@libs/game-session-shared-ts/game-session-position';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { HarnessComposition } from '@libs/harness-ts/composition';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { makeGameSessionMove } from './game-session-moves';
import { readGameSessionProbe } from './game-session-probe';
import { turnHarnessGameAt } from './harness-game-of';
import { queuedRandom, queueRoomDraws } from './room-draws';

/** Inject documented allowed choices through the room's random port. */
export function gameSessionBotRoomNode(
  createNode: NonNullable<HarnessComposition['roomNode']>
): NonNullable<HarnessComposition['roomNode']> {
  return (env, gateway) => {
    const port = queuedRandom(env);
    const node = Object.assign(
      createNode({ ...env, random: port.random }, gateway),
      { clientRandom: port.random }
    );
    port.register(node);
    return node;
  };
}

/** The next bot move is `action`, one of the position's legal moves. */
export const chooseGameSessionBotMove = scenarioAction({
  name: 'chooseGameSessionBotMove',
  act: async (s, observer: string, action: string) => {
    const game = (await readGameSessionProbe(s, observer))?.current;
    if (game === null || game === undefined)
      throw new Error('No Game Session to follow');
    const moves = gameSessionLegalMoves(
      game,
      s.harness.composition.app.turnGames
    );
    const index = moves.indexOf(action);
    if (index === -1) throw new Error(`${action} is not a legal bot choice`);
    queueRoomDraws(s, [(index + 0.5) / moves.length]);
  },
});

/** Let scheduled bot turns run until the game session is no longer active. */
export const playGameSessionBots = scenarioAction<
  [observer?: string, turns?: number]
>({
  name: 'playGameSessionBots',
  act: async (s: ProductHarness, observer = 'alice', turns = 600) => {
    for (let turn = 0; turn < turns; turn++) {
      const game = (await readGameSessionProbe(s, observer))?.current;
      if (game?.status !== 'active') return;
      await s.session.advanceTime(1000);
    }
  },
});

/** Finish a solo game: the person follows the game's automation and every bot takes its own turn. */
export const finishGameSessionAgainstBots = scenarioAction({
  name: 'finishGameSessionAgainstBots',
  act: async (s, observer: string) => {
    for (let turn = 0; turn < 600; turn++) {
      const probe = await readGameSessionProbe(s, observer);
      const current = probe?.current;
      if (probe === null || current === null || current === undefined)
        throw new Error('No game session');
      if (current.status !== 'active') return;
      if (current.turn === probe.mySide) {
        const game = turnHarnessGameAt(s, current.fen);
        const turns = game.shared.automation?.turns;
        if (turns === undefined) throw new Error('A bot turn needs turn rules');
        const action = turns.choose(current.fen, () => 0, probe.ownHand);
        if (action === null) throw new Error('Active game offers no action');
        await Promise.resolve(
          makeGameSessionMove.act(s, observer, game.shared.id, action)
        );
      }
      await s.session.advanceTime(1000);
    }
    throw new Error('The game did not finish within its bounded play');
  },
});
