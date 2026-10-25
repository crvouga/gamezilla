/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { encodeHearts } from '@libs/hearts-shared-ts/hearts-position';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { fireEvent } from '@solidjs/testing-library';
import { createStore } from 'solid-js/store';
import { byTestId, renderBoard } from './render';

const CLUBS = '2C3C4C5C6C7C8C9CTCJCQCKCAC';

/**
 * A board whose props change as the game would change them, each on its own:
 * a change to one never re-reads another.
 */
function liveBoard(initial: Partial<GameBoardProps> = {}) {
  const [props, setProps] = createStore<GameBoardProps>({
    position: heartsRules.initial(),
    orientation: 'white',
    interactive: true,
    sound: false,
    syncKey: 0,
    setup: null,
    hand: CLUBS,
    committed: [],
    commitment: null,
    testId: 'hearts',
    onAction: (action) => sent.push(action),
    ...initial,
  });
  const sent: string[] = [];
  renderBoard(() => <HeartsBoard {...props} />);
  const change = (next: Partial<GameBoardProps>) => setProps(next);
  return { sent, change };
}

const pressed = (card: string) =>
  byTestId(`hearts-card-${card}`).getAttribute('aria-pressed') === 'true';

// regression: hearts-refused-pass-loses-cards
test('a refused or failed pass keeps the three chosen cards to send again', () => {
  const board = liveBoard();
  for (const card of ['AC', 'KC', 'QC'])
    fireEvent.click(byTestId(`hearts-card-${card}`));
  fireEvent.click(byTestId('hearts-pass'));
  expect(board.sent).toEqual(['QCKCAC']);
  // While it is sent the cards are locked and the pass shows its progress.
  board.change({ interactive: false });
  expect(byTestId('hearts-pass').getAttribute('aria-busy')).toBe('true');
  // The game refused it: the board is reset and the person can act again.
  board.change({ interactive: true, syncKey: 1 });
  expect(['AC', 'KC', 'QC'].every(pressed)).toBe(true);
  expect(byTestId('hearts-pass').textContent).toContain('Pass 3 of 3 cards');
  fireEvent.click(byTestId('hearts-pass'));
  expect(board.sent).toEqual(['QCKCAC', 'QCKCAC']);
});

// regression: hearts-pass-merges-selection
test('a pass made for the person shows exactly the cards passed, never also an unfinished choice', () => {
  const board = liveBoard();
  for (const card of ['2C', '3C'])
    fireEvent.click(byTestId(`hearts-card-${card}`));
  // Away, a stand-in passed the queen, king and ace for them.
  board.change({
    commitment: 'QCKCAC',
    committed: ['white'],
    interactive: false,
  });
  expect(['QC', 'KC', 'AC'].every(pressed)).toBe(true);
  expect(pressed('2C') || pressed('3C')).toBe(false);
});

const FIRST_TRICK_WEST_TO_PLAY = encodeHearts({
  deal: 4,
  phase: 'play',
  scores: [10, 20, 30, 40],
  lead: 0,
  plays: ['2C'],
  last: [0, 0, 26, 0],
});

test('a card the rules refuse says why when pressed', () => {
  liveBoard({
    position: FIRST_TRICK_WEST_TO_PLAY,
    orientation: 'black',
    hand: '3C4DQS2H3H4H5H6H7H8H9HTHJH',
  });
  fireEvent.click(byTestId('hearts-card-4D'));
  expect(byTestId('hearts-refusal').textContent).toBe(
    'You must follow suit with a card of the suit led.'
  );
  expect(byTestId('hearts-card-4D').hasAttribute('aria-pressed')).toBe(false);
});

// regression: hearts-final-scores-unnamed
test('the end of the game names every score and the winners', () => {
  liveBoard({
    position: 'hearts:9:done:100,20,30,20:-::26,0,0,0',
    hand: null,
    interactive: false,
  });
  expect(byTestId('hearts-center').textContent).toBe(
    'The game is over. Final scores: South 100, West 20, North 30, East 20. West and East win.'
  );
});

test("until the next deal's first card, the table says what the last deal added", () => {
  liveBoard({ position: 'hearts:5:pass:10,20,30,40:-::0,0,26,0' });
  expect(byTestId('hearts-center').textContent).toContain(
    'Last deal added: South 0, West 0, North 26, East 0.'
  );
  expect(byTestId('hearts-center').textContent).toContain('to the left');
});

test('one card left is one card, and a seated player waiting for cards is told so', () => {
  const board = liveBoard({
    position: encodeHearts({
      deal: 4,
      phase: 'play',
      scores: [10, 20, 30, 40],
      lead: 0,
      plays: [],
      last: [0, 0, 26, 0],
    }),
    hand: null,
  });
  expect(byTestId('hearts-center').textContent).toBe(
    'Your cards are on their way.'
  );
  board.change({ hand: CLUBS });
  expect(byTestId('hearts-seat-white').textContent).toContain('13 cards');
});
