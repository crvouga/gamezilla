import {
  type Quoridor,
  quoridorDistance,
  quoridorWall,
} from './quoridor-geometry';

export type QuoridorWallRefusal =
  | 'finished'
  | 'outside'
  | 'no-walls'
  | 'overlap'
  | 'crossing'
  | 'blocks-path';

export function wallRefusal(
  game: Quoridor,
  action: string
): QuoridorWallRefusal | null {
  if (game.winner !== null) return 'finished';
  const wall = quoridorWall(action);
  if (wall === null) return 'outside';
  if (game.remaining[game.turn] === 0) return 'no-walls';
  for (const action of game.walls) {
    const other = quoridorWall(action)!;
    if (wall.direction !== other.direction) {
      if (wall.x === other.x && wall.y === other.y) return 'crossing';
    } else if (
      wall.direction === 'h'
        ? wall.y === other.y && Math.abs(wall.x - other.x) < 2
        : wall.x === other.x && Math.abs(wall.y - other.y) < 2
    )
      return 'overlap';
  }
  const next = { ...game, walls: [...game.walls, action] };
  return game.pawns.every((_, player) =>
    Number.isFinite(quoridorDistance(next, player))
  )
    ? null
    : 'blocks-path';
}

export function legalQuoridorWalls(game: Quoridor): readonly string[] {
  if (game.winner !== null || game.remaining[game.turn] === 0) return [];
  const walls: string[] = [];
  for (let y = 1; y <= 8; y++)
    for (let x = 0; x < 8; x++)
      for (const direction of ['h', 'v']) {
        const action = `${String.fromCharCode(97 + x)}${y}${direction}`;
        if (wallRefusal(game, action) === null) walls.push(action);
      }
  return walls;
}
