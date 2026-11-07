import { expect, test } from 'bun:test';
import { quoridorBoardCells } from '@libs/quoridor-client-ts/quoridor-board-cells';
import { quoridorFrame } from '@libs/quoridor-client-ts/quoridor-frame';
import {
  encodeQuoridor,
  newQuoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';

// regression: quoridor-hill-turn-coordinate-only
test('opening Hill turn wording names the center for active, opponent and spectator views', () => {
  const position = encodeQuoridor(newQuoridor('hill'));
  const frame = quoridorFrame(true);
  expect(frame.turnStatus(position, 'white', [], () => null)).toBe(
    'Your turn. Reach the center hill (e5) first.'
  );
  for (const viewer of ['black', null] as const)
    expect(frame.turnStatus(position, viewer, [], () => null)).toBe(
      'South red circle to move. First to the center hill (e5) wins.'
    );
});

// regression: quoridor-hill-destination-prominence
test('the center destination has a star inside its goal mark until a pawn reaches it', () => {
  const opening = quoridorBoardCells(newQuoridor('hill'), 'move', true, null);
  const goal = opening.find((cell) => cell.id === 'e5');
  expect(goal?.glyph).toBe('★');
  expect(goal?.label).toContain('Central hill');
  expect(goal?.goal).toBe(true);
  expect(goal?.outlined).toBe(false);
  expect(goal?.edges).toEqual([]);
  const won = replayQuoridor('hill', [
    'e2',
    'a4',
    'e8',
    'i4',
    'e3',
    'a3',
    'e7',
    'i3',
    'e4',
    'a2',
    'e6',
    'i2',
    'e5',
  ]);
  const occupied = quoridorBoardCells(won, 'move', false, null).find(
    (cell) => cell.id === 'e5'
  );
  expect(occupied?.glyph).toBe('●');
  expect(occupied?.identity).toBe('one');
  expect(occupied?.label).toContain('South red circle');
  expect(occupied?.goal).toBe(true);
  expect(occupied?.outlined).toBe(false);
  expect(
    quoridorFrame(true).turnStatus(encodeQuoridor(won), 'white', [], () => null)
  ).toBeNull();
});
