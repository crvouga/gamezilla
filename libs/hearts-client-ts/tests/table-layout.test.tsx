/** @jsxImportSource solid-js */
/**
 * The Hearts table says each thing once: the seats' facts live on the
 * table, the players' strips name the seat each sits in, the turn line is
 * the frame's, and a pass being sent keeps its words.
 */
import { afterEach, expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { heartsFrame } from '@libs/hearts-client-ts/hearts-frame';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import { byTestId, renderBoard } from './render';

afterEach(cleanup);

/** South's first five clubs and eight hearts; the first deal passes left. */
const HAND = '2C3C4C5C6C2H3H4H5H6H7H8H9H';

function board(overrides: Partial<GameBoardProps> = {}) {
  return renderBoard(() => (
    <HeartsBoard
      position={heartsRules.initial()}
      orientation="white"
      interactive
      sound={false}
      syncKey={0}
      setup={null}
      hand={HAND}
      committed={[]}
      commitment={null}
      testId="hearts"
      onAction={() => undefined}
      {...overrides}
    />
  ));
}

// regression: hearts-seat-facts-shown-twice
test("the players' strips name their seat; the table alone says each seat's cards and score", () => {
  const position = heartsRules.initial();
  expect(heartsFrame.seats.stat(position, 'black')).toBeNull();
  expect(heartsFrame.seats.facts(position, 'black', [])).toEqual(['West']);
  expect(heartsFrame.seats.facts(position, 'white', ['white'])).toEqual([
    'South',
  ]);
  board();
  const west = byTestId('hearts-seat-black').textContent ?? '';
  expect(west).toContain('13 cards');
  expect(west).toContain('Score 0');
  expect(west).toContain('Choosing');
});

// regression: hearts-turn-line-shown-twice
test('the table keeps its sentence for a listener and leaves the eye to the turn line', () => {
  board();
  const center = byTestId('hearts-center');
  expect(center.textContent).toContain('Choose three cards to pass');
  expect(center.getAttribute('aria-live')).toBe('polite');
  expect(center.getAttribute('data-spoken-only')).toBe('true');
  // Cards still on their way: the table alone says so, so it shows it.
  cleanup();
  board({ hand: null });
  expect(byTestId('hearts-center').getAttribute('data-spoken-only')).toBe(
    'false'
  );
});

// regression: hearts-pass-pending-unlabelled
test('a pass being sent keeps its words beside the spinner', () => {
  board();
  for (const card of ['2C', '3C', '4C'])
    fireEvent.click(byTestId(`hearts-card-${card}`));
  fireEvent.click(byTestId('hearts-pass'));
  const pass = byTestId('hearts-pass');
  expect(pass.getAttribute('aria-busy')).toBe('true');
  expect(pass.textContent).toContain('Passing your cards…');
});

// regression: hearts-table-tall-while-passing
test('while cards are passed the seats hold no room for a played card', () => {
  board();
  expect(byTestId('hearts-seat-black').getAttribute('data-trick')).toBe(
    'false'
  );
});
