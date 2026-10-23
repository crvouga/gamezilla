import {
  QUORIDOR_DIRECTIONS,
  type Quoridor,
  quoridorConnected,
  quoridorNeighbor,
} from './quoridor-geometry';

/** One-pawn jumps; a blocked landing permits either unblocked side-step. */
export function pawnMoves(
  game: Quoridor,
  player = game.turn
): readonly number[] {
  if (game.winner !== null || game.pawns[player] === undefined) return [];
  const from = game.pawns[player]!;
  const occupied = new Set(game.pawns);
  const moves = new Set<number>();
  for (const [dx, dy] of QUORIDOR_DIRECTIONS) {
    const adjacent = quoridorNeighbor(from, dx, dy);
    if (adjacent === null || !quoridorConnected(game.walls, from, adjacent))
      continue;
    if (!occupied.has(adjacent)) {
      moves.add(adjacent);
      continue;
    }
    const beyond = quoridorNeighbor(adjacent, dx, dy);
    if (
      beyond !== null &&
      !occupied.has(beyond) &&
      quoridorConnected(game.walls, adjacent, beyond)
    ) {
      moves.add(beyond);
      continue;
    }
    for (const sign of [-1, 1]) {
      const diagonal = quoridorNeighbor(adjacent, dy * sign, dx * sign);
      if (
        diagonal !== null &&
        !occupied.has(diagonal) &&
        quoridorConnected(game.walls, adjacent, diagonal)
      )
        moves.add(diagonal);
    }
  }
  return [...moves];
}
