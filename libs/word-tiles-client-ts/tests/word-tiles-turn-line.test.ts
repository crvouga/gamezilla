import { expect, test } from 'bun:test';
import { wordTilesFrame } from '@libs/word-tiles-client-ts/word-tiles-frame';
import {
  encodePosition,
  newPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

const START = encodePosition(newPosition(2, 'enable1.90ef7a729517'));
const names: Partial<Record<GameSide, string>> = {
  white: 'avery',
  black: 'jordan_plays',
};
const nameOf = (side: GameSide) => names[side] ?? null;

// regression: word-tiles-turn-line-seat-colour
test('the turn line names the player to move, and says your turn to that player', () => {
  const frame = wordTilesFrame(2);
  expect(frame.turnStatus(START, 'white', [], nameOf)).toBe(
    'Your turn · 86 tiles in the bag'
  );
  expect(frame.turnStatus(START, 'black', [], nameOf)).toBe(
    'avery to play · 86 tiles in the bag'
  );
  expect(frame.turnStatus(START, null, [], nameOf)).toBe(
    'avery to play · 86 tiles in the bag'
  );
  // Only an unnamed seat falls back to its colour.
  expect(frame.turnStatus(START, null, [], () => null)).toBe(
    'Amber to play · 86 tiles in the bag'
  );
});
