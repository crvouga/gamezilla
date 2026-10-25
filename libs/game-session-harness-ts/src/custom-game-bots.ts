import { customGameLegalMoves } from '@libs/game-session-shared-ts/custom-game-position';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { HarnessComposition } from '@libs/harness-ts/composition';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { makeCustomGameMove } from './custom-game-moves';
import { readCustomGameProbe } from './custom-game-probe';
import { turnHarnessGameAt } from './harness-game-of';
import { queuedRandom, queueRoomDraws } from './room-draws';

/** Inject documented allowed choices through the room's random port. */
export function customGameBotRoomNode(
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
export const chooseCustomGameBotMove = scenarioAction({
  name: 'chooseCustomGameBotMove',
  act: async (s, observer: string, action: string) => {
    const game = (await readCustomGameProbe(s, observer))?.current;
    if (game === null || game === undefined)
      throw new Error('No Custom Game to follow');
    const moves = customGameLegalMoves(
      game,
      s.harness.composition.app.turnGames
    );
    const index = moves.indexOf(action);
    if (index === -1) throw new Error(`${action} is not a legal bot choice`);
    queueRoomDraws(s, [(index + 0.5) / moves.length]);
  },
});

/** Let scheduled bot turns run until the custom game is no longer active. */
export const playCustomGameBots = scenarioAction<
  [observer?: string, turns?: number]
>({
  name: 'playCustomGameBots',
  act: async (s: ProductHarness, observer = 'alice', turns = 600) => {
    for (let turn = 0; turn < turns; turn++) {
      const game = (await readCustomGameProbe(s, observer))?.current;
      if (game?.status !== 'active') return;
      await s.session.advanceTime(1000);
    }
  },
});

/** Finish a solo game: the person follows the game's automation and every bot takes its own turn. */
export const finishCustomGameAgainstBots = scenarioAction({
  name: 'finishCustomGameAgainstBots',
  act: async (s, observer: string) => {
    for (let turn = 0; turn < 600; turn++) {
      const probe = await readCustomGameProbe(s, observer);
      const current = probe?.current;
      if (probe === null || current === null || current === undefined)
        throw new Error('No custom game');
      if (current.status !== 'active') return;
      if (current.turn === probe.mySide) {
        const game = turnHarnessGameAt(s, current.fen);
        const turns = game.shared.automation?.turns;
        if (turns === undefined) throw new Error('A bot turn needs turn rules');
        const action = turns.choose(
          current.fen,
          () => 0,
          probe.ownHand
        );
        if (action === null) throw new Error('Active game offers no action');
        await Promise.resolve(
          makeCustomGameMove.act(s, observer, game.shared.id, action)
        );
      }
      await s.session.advanceTime(1000);
    }
    throw new Error('The game did not finish within its bounded play');
  },
});
