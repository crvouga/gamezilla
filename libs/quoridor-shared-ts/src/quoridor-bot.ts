import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import { legalQuoridorActions } from './quoridor';
import {
  type Quoridor,
  quoridorCellName,
  quoridorDistance,
  quoridorGoal,
} from './quoridor-geometry';
import { pawnMoves } from './quoridor-movement';
import { legalQuoridorWalls } from './quoridor-walls';

function movementScore(game: Quoridor, cell: number): number {
  if (quoridorGoal(game, game.turn, cell)) return -1_000;
  return quoridorDistance(game, game.turn, cell);
}

function wallScore(game: Quoridor, action: string): number {
  const next = { ...game, walls: [...game.walls, action] };
  const ownCost =
    quoridorDistance(next, game.turn) - quoridorDistance(game, game.turn);
  let benefit = 0;
  for (let player = 0; player < game.pawns.length; player++) {
    if (player === game.turn) continue;
    const distance = quoridorDistance(game, player);
    const delay = quoridorDistance(next, player) - distance;
    const before = pawnMoves({ ...game, turn: player }).some((cell) =>
      quoridorGoal(game, player, cell)
    );
    const after = pawnMoves({ ...next, turn: player }).some((cell) =>
      quoridorGoal(game, player, cell)
    );
    benefit += before && !after ? 100 : delay / Math.max(1, distance);
  }
  return benefit - ownCost * 2;
}

/** All strengths race to this mode's goal; stronger play delays threatening opponents. */
export function chooseQuoridorAction(
  game: Quoridor,
  difficulty: BotDifficulty,
  random: () => number
): string | null {
  const moves = pawnMoves(game);
  if (moves.length === 0) return legalQuoridorActions(game)[0] ?? null;
  const bestDistance = Math.min(
    ...moves.map((cell) => movementScore(game, cell))
  );
  const candidates = moves.filter(
    (cell) => movementScore(game, cell) === bestDistance
  );
  const index = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(random() * candidates.length))
  );
  const move = quoridorCellName(candidates[index]!);
  if (
    bestDistance < 0 ||
    difficulty === 'easy' ||
    game.remaining[game.turn] === 0
  )
    return move;
  let selected = move;
  let best = difficulty === 'hard' ? 0.75 : 2;
  for (const action of legalQuoridorWalls(game)) {
    const score = wallScore(game, action);
    if (score <= best) continue;
    best = score;
    selected = action;
  }
  return selected;
}
