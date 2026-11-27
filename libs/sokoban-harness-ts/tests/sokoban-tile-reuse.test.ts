import { expect, test } from 'bun:test';
import { createSokobanTiles } from '@libs/sokoban-client-ts/sokoban-board-view';
import { useSokobanWords } from '@libs/sokoban-client-ts/use-sokoban-words';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';

test('a move keeps every unchanged tile and replaces only the changed ones', () => {
  const decoded = decodeSokobanBoard(
    JSON.stringify({ format: 1, rows: [' @$.'] })
  );
  if (!decoded.valid) throw new Error('Invalid corridor');
  const board = decoded.value;
  renderWithI18n(() => {
    const tiles = createSokobanTiles(board, useSokobanWords());
    const before = tiles(board);
    const after = tiles({ worker: { x: 0, y: 0 }, crates: board.crates });
    expect(after.map((tile) => tile.label)).toEqual([
      'A1: floor, worker',
      'B1: floor',
      'C1: floor, crate',
      'D1: goal',
    ]);
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[2]).toBe(before[2]);
    expect(after[3]).toBe(before[3]);
    return null;
  });
});
