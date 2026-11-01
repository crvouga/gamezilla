import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import { type CustomGame, customGamePersonSide } from './custom-game-state';

/**
 * Whether `choice`, made by `actor` with no connection, waits for it instead
 * of being refused: a participant's move in a custom game under way against
 * a bot, of a game with private setups or dealt hands. Only the room decides
 * such a move (it alone holds the bot's setup or hand), so the device sends
 * it once the connection returns and shows no result until then. Anyone
 * else's move could never be taken, so it is refused for the connection like
 * any game's.
 */
export function customGameChoiceWaits(
  game: CustomGame | null,
  choice: Pick<CustomGameChoice, 'operation'>,
  rules: TurnGames,
  actor: string
): boolean {
  return (
    choice.operation === 'move' &&
    game !== null &&
    game.status === 'active' &&
    customGamePersonSide(game, actor) !== null &&
    (rules.forPosition(game.fen).setup !== undefined ||
      rules.turnsForPosition(game.fen)?.hands !== undefined) &&
    game.sides.some((side) => game[side].kind === 'bot')
  );
}
