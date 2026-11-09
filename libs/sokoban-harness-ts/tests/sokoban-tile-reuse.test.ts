import { expect, test } from 'bun:test';
import { keepUnchangedTiles } from '@libs/sokoban-client-ts/sokoban-board-view';

test('a move keeps every unchanged tile and replaces only the changed ones', () => {
  const tile = (label: string) =>
    ({ terrain: 'open', marked: false, label }) as const;
  const before = [
    tile('A1: floor'),
    tile('B1: floor, worker'),
    tile('C1: floor'),
  ];
  const after = keepUnchangedTiles(before, [
    tile('A1: floor, worker'),
    tile('B1: floor'),
    tile('C1: floor'),
  ]);
  expect(after[0]).not.toBe(before[0]);
  expect(after[1]).not.toBe(before[1]);
  expect(after[2]).toBe(before[2]);
});
