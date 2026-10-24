import { expect, test } from 'bun:test';
import {
  newQuoridor,
  type Quoridor,
  quoridorDistance,
  quoridorGoal,
} from '@libs/quoridor-shared-ts/quoridor';
import {
  QUORIDOR_DIRECTIONS,
  quoridorConnected,
  quoridorNeighbor,
} from '@libs/quoridor-shared-ts/quoridor-geometry';

function cornerRectangle(corner: number, width: number, height: number) {
  const cells: number[] = [];
  const across = corner % 9 === 0 ? 1 : -1;
  const along = corner < 9 ? 9 : -9;
  for (let x = 0; x < width; x++)
    for (let y = 0; y < height; y++)
      cells.push(corner + x * across + y * along);
  return cells;
}

function cornerRectangles(): readonly (readonly number[])[] {
  const rectangles: number[][] = [];
  for (const corner of [0, 8, 72, 80])
    for (const width of [1, 2])
      for (const height of [1, 2])
        rectangles.push(cornerRectangle(corner, width, height));
  return rectangles;
}

const CORNER_RECTANGLES = cornerRectangles();

function boxedRectangles(walls: readonly string[]) {
  return CORNER_RECTANGLES.filter((rectangle) =>
    rectangle.every((cell) =>
      QUORIDOR_DIRECTIONS.every(([dx, dy]) => {
        const neighbor = quoridorNeighbor(cell, dx, dy);
        return (
          neighbor === null ||
          rectangle.includes(neighbor) ||
          !quoridorConnected(walls, cell, neighbor)
        );
      })
    )
  );
}

function mismatchedSquares(game: Quoridor, player: number) {
  const boxes = boxedRectangles(game.walls);
  const mismatches: number[] = [];
  for (let start = 0; start < 81; start++) {
    const cornerPath = boxes.every(
      (box) =>
        !box.includes(start) ||
        box.some((cell) => quoridorGoal(game, player, cell))
    );
    if (cornerPath !== Number.isFinite(quoridorDistance(game, player, start)))
      mismatches.push(start);
  }
  return mismatches;
}

function wallAnchors() {
  const walls: string[] = [];
  for (const column of 'abcdefgh')
    for (const row of '12345678')
      for (const orientation of ['h', 'v'])
        walls.push(`${column}${row}${orientation}`);
  return walls;
}

test('with two walls every separated component is a small corner rectangle', () => {
  const walls = wallAnchors();
  for (let first = 0; first < walls.length; first++)
    for (let second = first; second < walls.length; second++) {
      const placed = [walls[first]!, walls[second]!];
      for (const mode of ['classic', 'hill'] as const) {
        const game = { ...newQuoridor(mode), walls: placed };
        for (const player of mode === 'classic' ? [0, 1] : [0])
          expect({
            placed,
            mode,
            player,
            mismatches: mismatchedSquares(game, player),
          }).toEqual({ placed, mode, player, mismatches: [] });
      }
    }
});
