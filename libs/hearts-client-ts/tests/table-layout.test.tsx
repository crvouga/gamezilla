/** @jsxImportSource solid-js */
/**
 * The Hearts table says each thing once: the seats' facts live on the
 * table, the players' strips name the seat each sits in, the turn line is
 * the frame's, and a pass being sent keeps its words.
 */
import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import {
  heartsFrame,
  heartsOutline,
} from '@libs/hearts-client-ts/hearts-frame';
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
  expect(center.textContent).toContain(
    'Pass three cards to the left, to West.'
  );
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
// one fan of slivers with the suit's name printed sideways. The suit's name
// is in each card's words, not printed on its edge.
// regression: hearts-phone-hand-overlapping-rows — two staggered rows then
// hid the corners of the first row's cards behind the second's.
// regression: hearts-phone-hand-thin-strips — one row of thirteen then left
// each card a 24px strip. The hand is two rows, the upper a card longer,
// the lower half a step along and starting below the upper's corners; every
// card stays a button of the one hand, in order.
test('thirteen cards sit in two rows, every corner in view, each named by its suit', () => {
  board();
  const hand = byTestId('hearts-hand');
  expect(hand.getAttribute('data-crowded')).toBe('true');
  expect(hand.style.getPropertyValue('--hand-span')).toBe('6');
  const cards = [...hand.querySelectorAll('button')];
  expect(cards).toHaveLength(13);
  expect(cards.every((card) => card.parentElement === hand)).toBe(true);
  expect(
    cards.map((card) =>
      (card as HTMLElement).style.getPropertyValue('--hand-row')
    )
  ).toEqual(['0', '0', '0', '0', '0', '0', '0', '1', '1', '1', '1', '1', '1']);
  expect(byTestId('hearts-card-2H').textContent).toContain('hearts');
  expect(byTestId('hearts-card-2H').textContent).toContain('♥');
});

// regression: hearts-pass-pending-primary — a pass on its way showed as a
// filled primary button reading "Passing your cards…". The count chosen sits
// beside an explicit Pass button, and once sent the button goes quiet.
test('the count chosen sits beside the Pass button, which goes quiet once sent', () => {
  board();
  const action = () => byTestId('hearts-pass');
  expect(action().textContent).toContain('Pass to West');
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
  expect(table.textContent).toContain('Passing to West, on your left');
  fireEvent.click(byTestId('hearts-card-2C'));
  const placed = table.querySelectorAll('[data-filled="true"]');
  expect(placed).toHaveLength(1);
  expect(placed[0]?.textContent).toContain('♣');
});

// regression: hearts-record-card-only-a-sentence — beside a wide table the
// record card said only "Pass three cards to the left." Hearts gives the
// frame its passing order, the deal under way marked, and nothing once the
// game is over.
test('the passing order of the four deals, the one under way marked', () => {
  expect(heartsFrame.outline).toBe(heartsOutline);
  expect(heartsOutline(heartsRules.initial())).toEqual([
    { label: 'Deal 1', detail: 'Pass left', current: true },
    { label: 'Deal 2', detail: 'Pass right', current: false },
    { label: 'Deal 3', detail: 'Pass across', current: false },
    { label: 'Deal 4', detail: 'No passing', current: false },
  ]);
});

// regression: hearts-story-pass-already-sent — the "Pass three cards" story
// pressed Pass itself, so the screen it showed had three cards chosen,
// "Passing your cards…" and no button to pass them. It stops at the moment
// before passing (the filled Pass button ready); a separate story sends.
test('the pass-three-cards story stops before passing; another story sends the pass', () => {
  const stories = readFileSync(
    join(import.meta.dirname, '../src/hearts-board.stories.tsx'),
    'utf8'
  );
  const story = (name: string): string => {
    const start = stories.indexOf(`export const ${name}: Story = {`);
    if (start < 0) throw new Error(`no story ${name}`);
    return stories.slice(start, stories.indexOf('\n};\n', start));
  };
  const ready = story('PassThreeCards');
  expect(ready).toContain('chooseThree(canvasElement)');
  expect(ready).not.toContain('userEvent.click');
  expect(ready).toContain("toHaveAttribute('data-variant', 'solid')");
  expect(ready).toContain('not.toHaveBeenCalled()');
  const sending = story('PassSending');
  expect(sending).toContain("findByTestId('custom-game-board-pass')");
  expect(sending).toContain('toHaveBeenCalledWith(writeCards(PASSED))');
});
