import {
  type HarnessGame,
  isTurnHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';

/**
 * The accepted choice for sample `index`: a turn game's clock, or a game
 * without turns alternating between two of its options.
 */
export function measuredChoice(game: HarnessGame, index: number) {
  if (isTurnHarnessGame(game))
    return {
      operation: 'clock' as const,
      minutes: 1,
      increment: index % 2 === 0 ? 2 : 0,
    };
  const choices = game.configurationChoices;
  if (choices === undefined)
    throw new Error(`${game.label} declares no game options to choose`);
  return { operation: 'rules' as const, choice: choices[index % 2]! };
}
