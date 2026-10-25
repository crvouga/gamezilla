import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import type { CustomGame } from './custom-game-state';

/**
 * Whether `choice`, made with no connection, waits for it instead of being
 * refused: a move in a custom game under way against a bot, of a game with
 * private setups. Only the room decides such a move (it alone holds the
 * bot's setup), so the device sends it once the connection returns and shows
 * no result until then.
 */
export function customGameChoiceWaits(
  game: CustomGame | null,
  choice: Pick<CustomGameChoice, 'operation'>,
  rules: TurnGames
): boolean {
  return (
    (choice.operation === 'move' || choice.operation === 'commit') &&
    game !== null &&
    game.status === 'active' &&
    (rules.forPosition(game.fen).setup !== undefined ||
      rules.turnsForPosition(game.fen)?.hands !== undefined) &&
    game.sides.some((side) => game[side].kind === 'bot')
  );
}
