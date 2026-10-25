import { describe, expect, test } from 'bun:test';
import {
  assignBlank,
  candidateProposal,
  newCandidate,
  pressCell,
  pressTile,
  rebase,
  recallAll,
  redoEdit,
  shuffleRack,
  toggleExchange,
  undoEdit,
} from '@libs/word-tiles-client-ts/word-tiles-candidate';
import { parseCell } from '@libs/word-tiles-shared-ts/word-tiles-board';
import {
  encodePosition,
  newPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';

const START = encodePosition(newPosition(2, 'enable1.90ef7a729517'));
// C (11), A (0), T (82), blank (98), E (25), S (77), Q (69)
const HAND = '11,0,82,98,25,77,69';
const h8 = parseCell('h8')!;
const i8 = parseCell('i8')!;

function placeOn(cells: readonly number[], tiles: readonly number[]) {
  let c = newCandidate(START, HAND);
  cells.forEach((cell, n) => {
    c = pressCell(pressTile(c, tiles[n]!), cell);
  });
  return c;
}

describe('the candidate', () => {
  test('placing tiles makes one atomic proposal, in cell order', () => {
    const c = placeOn([i8, h8], [0, 11]);
    expect(candidateProposal(c)).toBe('play:h8=11.i8=0');
  });
  test('a tentative tile pressed again goes back to the rack', () => {
    const c = pressCell(placeOn([h8], [11]), h8);
    expect(c.placed).toEqual([]);
    expect(candidateProposal(c)).toBeNull();
  });
  test('a blank waits for its letter, which can change before submitting', () => {
    let c = placeOn([h8], [98]);
    expect(c.blankAt).toBe(h8);
    expect(candidateProposal(c)).toBeNull();
    c = assignBlank(c, 'E');
    expect(candidateProposal(c)).toBe('play:h8=98E');
    c = pressCell(c, h8);
    c = assignBlank(pressCell(pressTile(c, 98), h8), 'O');
    expect(candidateProposal(c)).toBe('play:h8=98O');
  });
  test('two rack tiles pressed in turn swap places, without placing anything', () => {
    const c = pressTile(pressTile(newCandidate(START, HAND), 11), 69);
    expect(c.order.slice(0, 1)).toEqual([69]);
    expect(c.order.at(-1)).toBe(11);
    expect(c.placed).toEqual([]);
  });
  test('shuffling only reorders the rack', () => {
    const c = shuffleRack(placeOn([h8], [11]), () => 0);
    expect([...c.order].sort((a, b) => a - b)).toEqual(
      HAND.split(',')
        .map(Number)
        .sort((a, b) => a - b)
    );
    expect(c.placed).toHaveLength(1);
  });
  test('undo and redo change only the uncommitted candidate', () => {
    const placed = placeOn([h8, i8], [11, 0]);
    const undone = undoEdit(placed);
    expect(undone.placed).toHaveLength(1);
    expect(redoEdit(undone).placed).toHaveLength(2);
    expect(recallAll(placed).placed).toEqual([]);
  });
  test('an exchange chooses rack tiles instead of placing them', () => {
    let c = toggleExchange(placeOn([h8], [11]));
    expect(c.placed).toEqual([]);
    c = pressTile(pressTile(c, 69), 25);
    expect(candidateProposal(c)).toBe('swap:69.25');
  });
  test('a candidate never carries stale tiles into a later position', () => {
    const c = placeOn([h8, i8], [11, 0]);
    const later = START.replace('|0|0|-', '|1|0|-');
    // The opponent took h8 meanwhile, and the A left this rack.
    const board = '.'.repeat(112) + 'X' + '.'.repeat(112);
    const moved = later.replace('.'.repeat(225), board);
    const next = rebase(c, moved, '11,82,98,25,77,69,3');
    expect(next.placed).toEqual([]);
    expect(next.order).toContain(3);
    expect(next.order).not.toContain(0);
  });
});
