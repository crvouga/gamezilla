import type { GameBots, TurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { CustomGame } from './custom-game-state';
/** A retained position must describe exactly the accepted action sequence. */
export function assertCustomGamePosition(
  game: CustomGame,
  rules: TurnGames
): void {
  const actions = game.moves.map((move) => move.uci);
  if (rules.forPosition(game.fen).replay(actions, actions.length) !== game.fen)
    throw new Error(
      'The retained game position does not match its action history'
    );
}
export function customGamePositionAt(
  game: CustomGame,
  ply: number,
  rules: TurnGames
): string | null {
  assertCustomGamePosition(game, rules);
  if (!Number.isInteger(ply) || ply < 0 || ply > game.moves.length) return null;
  return rules.forPosition(game.fen).replay(
    game.moves.map((move) => move.uci),
    ply
  );
}
/** The bots of the custom game's own game. */
export function customGameBots(game: CustomGame, rules: TurnGames): GameBots {
  const customGames = rules.capability(
    rules.forPosition(game.fen).id,
    'custom-games'
  );
  if (customGames === undefined)
    throw new Error('The game offers no Custom Games');
  return customGames.bots;
}
/** The bot's choice for the side to move, at its difficulty. */
export function customGameBotMove(
  game: CustomGame,
  rules: TurnGames,
  random: () => number
): string | null {
  return customGameBots(game, rules).choose(
    game.fen,
    game.difficulty[game.turn],
    random
  );
}
export function customGameLegalMoves(
  game: CustomGame,
  rules: TurnGames
): readonly string[] {
  return game.status === 'active'
    ? rules.forPosition(game.fen).legal(game.fen)
    : [];
}
