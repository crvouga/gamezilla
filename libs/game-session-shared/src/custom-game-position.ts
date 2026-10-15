import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { CustomGame } from './custom-game-state';
export function customGamePositionAt(
  game: CustomGame,
  ply: number,
  rules: TurnGames
): string | null {
  if (!Number.isInteger(ply) || ply < 0 || ply > game.moves.length) return null;
  return rules.forPosition(game.fen).replay(
    game.moves.map((move) => move.uci),
    ply
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
