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
  expect(center.textContent).toContain('Pass three cards to the left.');
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

// regression: hearts-pass-status-contradicts — once three cards were sent
// the button said "Passing your cards…" while the line beside the table
// still told the person to choose three cards and the hand stayed open.
// The line names the pass itself, and a pass on its way locks the hand.
test('a pass on its way locks the hand and the line never asks to choose again', () => {
  board();
  expect(byTestId('hearts-center').textContent).not.toContain('Choose');
  for (const card of ['2C', '3C', '4C'])
    fireEvent.click(byTestId(`hearts-card-${card}`));
  fireEvent.click(byTestId('hearts-pass'));
  for (const card of ['2C', '3C', '4C']) {
    expect(byTestId(`hearts-card-${card}`).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(byTestId(`hearts-card-${card}`).getAttribute('aria-disabled')).toBe(
      'true'
    );
  }
  expect(byTestId('hearts-card-5C').getAttribute('aria-disabled')).toBe('true');
  expect(byTestId('hearts-center').textContent).not.toContain('Choose');
});

// regression: hearts-hand-greyed-while-passing — once three cards were sent
// every other card dimmed, so the whole hand read as disabled. Only a card
// the rules refuse dims; a card that waits keeps full contrast.
test('a pass on its way keeps the hand at full contrast; only a refused card dims', () => {
  board();
  for (const card of ['2C', '3C', '4C'])
    fireEvent.click(byTestId(`hearts-card-${card}`));
  fireEvent.click(byTestId('hearts-pass'));
  expect(byTestId('hearts-card-5C').getAttribute('aria-disabled')).toBe('true');
  expect(byTestId('hearts-card-5C').getAttribute('data-refused')).toBe('false');
});

// regression: hearts-phone-hand-slivers — on a phone thirteen cards were
// one fan of slivers with the suit's name printed sideways. A narrow hand of
// more than seven cards is two staggered rows, the first one card longer,
// and the suit's name is in each card's words, not printed on its edge.
test('thirteen cards sit in two rows, seven then six, each still named by its suit', () => {
  board();
  const hand = byTestId('hearts-hand');
  expect(hand.getAttribute('data-rows')).toBe('2');
  const rows = [...hand.querySelectorAll('button')].map((card) =>
    card.getAttribute('data-row')
  );
  expect(rows.filter((row) => row === '0')).toHaveLength(7);
  expect(rows.filter((row) => row === '1')).toHaveLength(6);
  expect(byTestId('hearts-card-2H').textContent).toContain('hearts');
  expect(byTestId('hearts-card-2H').textContent).toContain('♥');
});

// regression: hearts-pass-pending-primary — a pass on its way showed as a
// filled primary button reading "Passing your cards…". The count chosen sits
// beside an explicit Pass button, and once sent the button goes quiet.
test('the count chosen sits beside the Pass button, which goes quiet once sent', () => {
  board();
  const action = () => byTestId('hearts-pass');
  expect(action().textContent).toContain('Pass left');
  expect(action().parentElement?.textContent).toContain('0 of 3 chosen');
  for (const card of ['2C', '3C', '4C'])
    fireEvent.click(byTestId(`hearts-card-${card}`));
  expect(action().parentElement?.textContent).toContain('3 of 3 chosen');
  expect(action().getAttribute('data-variant')).toBe('solid');
  fireEvent.click(action());
  expect(action().getAttribute('data-variant')).toBe('ghost');
  expect(action().getAttribute('aria-busy')).toBe('true');
});

// regression: hearts-pass-centre-empty — while cards were passed the middle
// of the table was bare felt. It says where the pass goes and fills a
// place for each card as it is chosen.
test('the middle of the table shows where the pass goes and the cards chosen', () => {
  board();
  const table = byTestId('hearts');
  expect(table.textContent).toContain('Passing to the left');
  fireEvent.click(byTestId('hearts-card-2C'));
  const placed = table.querySelectorAll('[data-filled="true"]');
  expect(placed).toHaveLength(1);
  expect(placed[0]?.textContent).toContain('♣');
});
