/**
 * Battleship against bots, reached through ordinary custom-game choices:
 * the creator seats a bot, picks its difficulty and, with no person to
 * wait for, starts; the room readies each bot with a fleet of its own.
 */

import type { CustomGameSeat } from '@libs/game-session-harness/custom-game-lineup';
import { readCustomGameScreen } from '@libs/game-session-harness/custom-game-screen';
import { configureCustomGame } from '@libs/game-session-harness/custom-game-ui';
import { scenarioAction } from '@libs/harness/actor-ui';
import { establishBattleship } from './battleship-actions';

export type BattleshipBotDifficulty = 'easy' | 'medium' | 'hard';

const BOT_TURN_MS = 1000;
/** Two bots fire at most 200 shots. */
const MAX_BOT_TURNS = 400;

/**
 * Alice (the host) seats `first` and `second`, each bot at `difficulty`,
 * and every person seated becomes ready with their known fleet; the game is
 * not started.
 */
export const establishBattleshipBots = scenarioAction({
  name: 'establishBattleshipBots',
  act: async (
    s,
    first: CustomGameSeat,
    second: CustomGameSeat,
    difficulty: BattleshipBotDifficulty
  ) => {
    await Promise.resolve(
      establishBattleship.act(s, {
        first,
        second,
        ready: false,
        active: false,
      })
    );
    const seats = { white: first, black: second } as const;
    for (const side of ['white', 'black'] as const)
      if (seats[side] === 'bot')
        await configureCustomGame(s, 'alice', {
          operation: 'difficulty',
          side,
          difficulty,
        });
    for (const side of ['white', 'black'] as const)
      if (seats[side] !== 'bot' && seats[side] !== 'open')
        await configureCustomGame(s, seats[side], { operation: 'ready' });
  },
});

/** Let the bots take their turns until the game is over. */
export const letBattleshipBotsPlay = scenarioAction({
  name: 'letBattleshipBotsPlay',
  act: async (s, observer: string) => {
    for (let turn = 0; turn < MAX_BOT_TURNS; turn += 1) {
      const game = (await readCustomGameScreen(s, observer))?.current;
      if (game?.status !== 'active') return;
      await s.session.advanceTime(BOT_TURN_MS);
    }
  },
});

export const BATTLESHIP_BOT_ACTIONS = [
  establishBattleshipBots,
  letBattleshipBotsPlay,
];
