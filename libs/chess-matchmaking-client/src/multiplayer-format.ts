import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { multiplayerBoard } from '@libs/chess-matchmaking-shared/game-state';

/** A clock as people read it: whole seconds left, rounded up, as m:ss. */
export function clockLabel(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The accepted moves in algebraic notation: `1. e4 e5 2. Nf3`. */
export function moveListText(
  game: Pick<MultiplayerGame, 'fen' | 'pgn'>
): string {
  if (game.pgn.length === 0) return '';
  const moves = multiplayerBoard(game).history({ verbose: true });
  const parts: string[] = [];
  moves.forEach((move, index) => {
    const number = move.before.split(' ')[5] ?? '1';
    if (move.color === 'w') parts.push(`${number}. ${move.san}`);
    else if (index === 0) parts.push(`${number}... ${move.san}`);
    else parts.push(move.san);
  });
  return parts.join(' ');
}
