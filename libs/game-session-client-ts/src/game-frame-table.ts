import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * How the seats sit around the board while a game is played.
 *
 * - `near`: the seat below the board, nearest the person holding the
 *   device: their own seat, or for someone watching the board's first side
 *   (the side the board is drawn from), so a watcher reads the table the
 *   same way as the first player. `null` at a solo table.
 * - `others`: every other seat, above the board, in seat order.
 * - `shape`: one other seat is a full strip; two or more are a rail of
 *   chips; a solo table shows no seats at all.
 */
export type FrameTable = {
  readonly near: GameSide | null;
  readonly others: readonly GameSide[];
  readonly shape: 'strip' | 'rail' | 'none';
};

export function frameTable(
  sides: readonly GameSide[],
  viewer: GameSide | null
): FrameTable {
  if (sides.length < 2) return { near: null, others: [], shape: 'none' };
  const near = viewer !== null && sides.includes(viewer) ? viewer : sides[0]!;
  const others = sides.filter((side) => side !== near);
  return { near, others, shape: others.length === 1 ? 'strip' : 'rail' };
}

/** Whether two tables seat everyone in the same places. */
export function sameTable(a: FrameTable, b: FrameTable): boolean {
  return (
    a.near === b.near &&
    a.shape === b.shape &&
    a.others.length === b.others.length &&
    a.others.every((side, index) => b.others[index] === side)
  );
}
